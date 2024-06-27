const Paho = require('paho-mqtt'); 
var protocol = window.location.protocol;
 
 var mqttBroker='home.onesmartapi.com';
 var userName='dinuka';
 var password='dinuka'
 var port = protocol === 'https:' ? 8084 : 1884;
 var mqttClientId = Math.floor(Math.random() * 1000);
var mqttUseSSL = protocol === 'https:';

if(protocol === 'https')
{
     mqttClientId ='wss/'+mqttClientId;
}else{
 
     mqttClientId ='ws/'+mqttClientId;
}

var client = new Paho.MQTT.Client(mqttBroker, port, mqttClientId);

console.log("client ID:-"+mqttClientId);

