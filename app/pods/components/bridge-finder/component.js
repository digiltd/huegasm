import Em from 'ember';

export default Em.Component.extend({
  classNames: ['container', 'bridgeFinder'],

  bridgeIp: null,
  trial: false,
  bridgeUsername: null,

  bridgeFindStatus: null,
  bridgeFindSuccess: Em.computed.equal('bridgeFindStatus', 'success'),
  bridgeFindMultiple: Em.computed.equal('bridgeFindStatus', 'multiple'),
  bridgeFindFail: Em.computed.equal('bridgeFindStatus', 'fail'),

  // 30 seconds
  bridgeUsernamePingMaxTime: 30000,
  bridgeUsernamePingIntervalTime: 1000,
  bridgeUserNamePingIntervalProgress: 0,

  bridgePingIntervalHandle: null,
  bridgeAuthenticateReachedStatus: null,

  manualBridgeIp: null,
  manualBridgeIpNotFound: false,
  multipleBridgeIps: [],

  actions: {
    retry(){
      this.onBridgeIpChange();
    },

    findBridgeByIp() {
      var manualBridgeIp = this.get('manualBridgeIp'), self = this;

      if (manualBridgeIp.toLowerCase() === 'trial') {
        this.setProperties({
          trial: true,
          bridgeIp: 'trial',
          bridgeUsername: 'trial'
        });
      } else {
        Em.$.ajax('http://' + manualBridgeIp + '/api', {
          data: JSON.stringify({"devicetype": "huegasm"}),
          contentType: 'application/json',
          type: 'POST'
        }).fail(function () {
          self.set('manualBridgeIpNotFound', true);
          setTimeout(function(){ self.set('manualBridgeIpNotFound', false); }, 5000);
        }).then(function () {
          self.set('bridgeIp', manualBridgeIp);
        });
      }
    }
  },

  didInsertElement() {
    var self = this;

    Em.$(document).keypress(function(event) {
      if(!Em.isNone(self.get('manualBridgeIp')) && event.which === 13) {
        self.send('findBridgeByIp');
      }
    });
  },

  // find the bridge ip here
  init() {
    this._super();

    if(this.get('bridgeIp') === null){
      var self = this;

      Em.$.get('https://www.meethue.com/api/nupnp', function (result, status) {
        var bridgeFindStatus = 'fail';

        if (status === 'success' && result.length === 1) {
          self.set('bridgeIp', result[0].internalipaddress);
          localStorage.setItem('huegasm.bridgeIp', result[0].internalipaddress);
          bridgeFindStatus = 'success';
        } else if(result.length > 1) {
          var multipleBridgeIps = self.get('multipleBridgeIps');

          result.forEach(function(item) {
            multipleBridgeIps.push(item.internalipaddress);
          });

          bridgeFindStatus = 'multiple';
        } else {
          bridgeFindStatus = 'fail';
        }

        self.set('bridgeFindStatus', bridgeFindStatus);
      });
    }
  },

  // try to authenticate against the bridge here
  onBridgeIpChange: function () {
    if(!this.get('trial')) {
      this.setProperties({
        bridgePingIntervalHandle: setInterval(this.pingBridgeUser.bind(this), this.get('bridgeUsernamePingIntervalTime')),
        bridgeUserNamePingIntervalProgress: 0
      });
    }
  }.observes('bridgeIp'),

  pingBridgeUser() {
    var bridgeIp = this.get('bridgeIp'), self = this, bridgeUserNamePingIntervalProgress = this.get('bridgeUserNamePingIntervalProgress'),
      bridgeUsernamePingMaxTime = this.get('bridgeUsernamePingMaxTime');

    if (bridgeIp !== null && bridgeUserNamePingIntervalProgress < 100) {
      Em.$.ajax('http://' + bridgeIp + '/api', {
        data: JSON.stringify({"devicetype": "huegasm"}),
        contentType: 'application/json',
        type: 'POST'
      }).done(function (result, status) {
        if (status === 'success') {
          if (!result[0].error) {
            self.set('bridgeUsername', result[0].success.username);
            localStorage.setItem('huegasm.bridgeUsername', result[0].success.username);
            clearInterval(self.get('bridgePingIntervalHandle'));
            self.set('bridgePingIntervalHandle', null);
          }
          self.set('bridgeAuthenticateError', result[0].internalipaddress);
        }

        self.set('bridgeAuthenticateReachedStatus', status);
      });

      this.incrementProperty('bridgeUserNamePingIntervalProgress', this.get('bridgeUsernamePingIntervalTime')/bridgeUsernamePingMaxTime*100);
    } else {
      clearInterval(this.get('bridgePingIntervalHandle'));
      this.set('bridgePingIntervalHandle', null);
    }
  },

  isAuthenticating: function(){
    return this.get('bridgePingIntervalHandle') !== null;
  }.property('bridgePingIntervalHandle')
});