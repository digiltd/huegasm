import Ember from 'ember';

const {
  Component,
  observer,
  computed,
  on,
  isNone,
  $
} = Ember;

export default Component.extend({
  classNames: ['container', 'bridgeFinder'],
  bridgeIp: null,
  trial: false,
  bridgeUsername: null,
  bridgeFindStatus: null,
  bridgeFindSuccess: computed.equal('bridgeFindStatus', 'success'),
  bridgeFindMultiple: computed.equal('bridgeFindStatus', 'multiple'),
  bridgeFindFail: computed.equal('bridgeFindStatus', 'fail'),
  bridgeUsernamePingMaxTime: 30000, // 30 seconds
  bridgeUsernamePingIntervalTime: 1000,
  bridgeUserNamePingIntervalProgress: 0,
  bridgePingIntervalHandle: null,
  bridgeAuthenticateReachedStatus: null,
  manualBridgeIp: null,
  manualBridgeIpNotFound: false,
  multipleBridgeIps: [],
  error: false,

  isAuthenticating: computed('bridgePingIntervalHandle', function(){
    return this.get('bridgePingIntervalHandle') !== null;
  }),

  // try to authenticate against the bridge here
  onBridgeIpChange: on('init', observer('bridgeIp', function(){
    if(!this.get('trial') && !this.get('isAuthenticating')) {
      this.setProperties({
        bridgePingIntervalHandle: setInterval(this.pingBridgeUser.bind(this), this.get('bridgeUsernamePingIntervalTime')),
        bridgeUserNamePingIntervalProgress: 0
      });
    }
  })),

  didInsertElement() {
    $(document).keypress((event)=>{
      if(!isNone(this.get('manualBridgeIp')) && event.which === 13) {
        this.send('findBridgeByIp');
      }
    });
  },

  // find the bridge ip here
  init() {
    this._super();

    if(this.get('bridgeIp') === null) {
      $.ajax('https://www.meethue.com/api/nupnp', {
        timeout: 30000
      })
      .done((result, status)=> {
          let bridgeFindStatus = 'fail';

          if (status === 'success' && result.length === 1) {
            this.set('bridgeIp', result[0].internalipaddress);
            this.get('storage').set('huegasm.bridgeIp', result[0].internalipaddress);
            bridgeFindStatus = 'success';
          } else if (result.length > 1) {
            let multipleBridgeIps = this.get('multipleBridgeIps');

            result.forEach(function (item) {
              multipleBridgeIps.pushObject(item.internalipaddress);
            });

            bridgeFindStatus = 'multiple';
          } else {
            bridgeFindStatus = 'fail';
          }

          this.set('bridgeFindStatus', bridgeFindStatus);
        })
      .fail(()=>{
          this.set('bridgeFindStatus', 'fail');
      });
    }
  },

  pingBridgeUser() {
    let bridgeIp = this.get('bridgeIp'),
      bridgeUserNamePingIntervalProgress = this.get('bridgeUserNamePingIntervalProgress'),
      bridgeUsernamePingMaxTime = this.get('bridgeUsernamePingMaxTime');

    if (bridgeIp !== null && bridgeUserNamePingIntervalProgress < 100) {
      $.ajax('http://' + bridgeIp + '/api', {
        data: JSON.stringify({"devicetype": "huegasm"}),
        contentType: 'application/json',
        type: 'POST'
      }).done((result, status)=>{
        if (status === 'success' && !result[0].error) {
          this.clearBridgePingIntervalHandle();
          this.set('bridgeUsername', result[0].success.username);
          this.get('storage').set('huegasm.bridgeUsername', result[0].success.username);
        }

        this.set('bridgeAuthenticateReachedStatus', status);
      }).fail(()=>{
        this.clearBridgePingIntervalHandle();
        this.set('error', true);
      });

      this.incrementProperty('bridgeUserNamePingIntervalProgress', this.get('bridgeUsernamePingIntervalTime')/bridgeUsernamePingMaxTime*100);
    } else {
      this.clearBridgePingIntervalHandle();
    }
  },

  clearBridgePingIntervalHandle(){
    clearInterval(this.get('bridgePingIntervalHandle'));
    this.set('bridgePingIntervalHandle', null);
  },

  actions: {
    retry(){
      this.onBridgeIpChange();
    },

    findBridgeByIp() {
      let manualBridgeIp = this.get('manualBridgeIp');

      if (manualBridgeIp.toLowerCase() === 'trial' || manualBridgeIp.toLowerCase() === 'offline') {
        this.setProperties({
          trial: true,
          bridgeIp: 'trial',
          bridgeUsername: 'trial'
        });
      } else {
        $.ajax('http://' + manualBridgeIp + '/api', {
          data: JSON.stringify({"devicetype": "huegasm"}),
          contentType: 'application/json',
          type: 'POST'
        }).fail(() => {
          this.set('manualBridgeIpNotFound', true);
          setTimeout(() => { this.set('manualBridgeIpNotFound', false); }, 5000);
        }).then(() => {
          this.set('bridgeIp', manualBridgeIp);
        });
      }
    }
  },
});
