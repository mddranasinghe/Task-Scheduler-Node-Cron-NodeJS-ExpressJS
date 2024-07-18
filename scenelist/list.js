const fs = require('fs-extra');
const mqtt = require('mqtt'); 

const top = 'v2jlcwytpqaufx/scene/#';
var public_topic="v2jlcwytpqaufx/scene/list";

// MQTT Broker details

const mqttBroker = 'ws://home.onesmartapi.com:1884/mqtt'; 
const userName = 'dinuka';
const password = 'dinuka';

const mqttOptions = {
  clientId: `mqtt_${Math.floor(Math.random() * 1000)}`,
  username: userName,
  password: password,

};
//var tasks = [], task;


const client = mqtt.connect(mqttBroker, mqttOptions);

client.on('connect', () => {
  console.log("Connected to MQTT Broker");
 // getList();
  client.subscribe(top, (err) => {
    if (err) {
      console.error("Subscription error:", err);
    } else {
      console.log("Subscribed to topic 'v2jlcwytpqaufx/scene/#");
    }
  });
});

client.on('message', (topic, message) => {
try{
    topic = topic;
    payload=message;
    payload = JSON.parse(payload);
    console.log("Payload:" + payload);
    console.log("Topic:", topic);
   // topicsArray = topic.split("/");
   // jobid=topicsArray[4];
   //
   if(payload == '1'){

    console.log('ok')
    getList();
  
  }

  } catch (error) {
    console.error("Message handling error:", error);
  }

});

client.on('error', (err) => {
  console.error(`Connection error: ${err}`);
});

client.on('close', () => {
  console.log('MQTT connection closed');
});

client.on('reconnect', () => {
  console.log('MQTT client reconnecting');
});

client.on('offline', () => {
  console.log('MQTT client is offline');
});

function sendCommandToDevice(topic, payload) {
  if (client.connected) {
    console.log(`sendCommandToDevice: ${topic}, Payload: ${payload}`);
    client.publish(topic, payload);
  }
}


let schedules = loadSchedules(); 

//getList();

function loadSchedules() {
  try {

    const data = fs.readFileSync('list.json', 'utf8');
    const parsedSchedules = JSON.parse(data);

    if (typeof global.currentTasks !== 'undefined') {
      global.currentTasks.forEach(task => task.stop());
    }
    global.currentTasks = [];


    global.schedules = parsedSchedules;

    return parsedSchedules;
  } catch (error) {
    console.error('Error reading schedules file:', error);
    return [];
  }
}

console.log(JSON.stringify(schedules, null, 2));

function getList() {
  const jobList = schedules.map(schedule => {

    return {
      scene_id:schedule.scene_id,
      scene_name:schedule.scene_name,
      scene_description:schedule.scene_description,
      scene_icon:schedule.scene_icon,
      favorite:schedule.favorite
    };
  });

  sendCommandToDevice(public_topic, JSON.stringify(jobList));
}

