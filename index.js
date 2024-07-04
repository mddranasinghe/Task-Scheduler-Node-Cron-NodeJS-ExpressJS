const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors'); 
const mqtt = require('mqtt'); 

const app = express();
app.use(bodyParser.json());
app.use(cors()); 

const jobs = {};
const top = 'v2jlcwytpqaufx/scene/#';
public_topic="v2jlcwytpqaufx/scene/timers";

// MQTT Broker details

const mqttBroker = 'ws://home.onesmartapi.com:1884/mqtt'; 
const userName = 'dinuka';
const password = 'dinuka';

const mqttOptions = {
  clientId: `mqtt_${Math.floor(Math.random() * 1000)}`,
  username: userName,
  password: password,

};



const client = mqtt.connect(mqttBroker, mqttOptions);

client.on('connect', () => {
  console.log("Connected to MQTT Broker");
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

    console.log("Payload:" + payload);
    console.log("Topic:", topic);
    topicsArray = topic.split("/");
    jobid=topicsArray[4];

  
    if (topicsArray[3] === 'list') {
      getList();
    } else if (topicsArray[3] === 'set') {
     // const jobId = 0;
      AddSchedule(payload);
    } else if (topicsArray[3] === 'update') {
      const jobId = topicsArray[4];
      updateJob(payload, jobId);
    } else if (topicsArray[3] === 'delete') {
      jobdelete(payload);
    } else {
      console.error("Unknown topic action:", topicsArray[3]);
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

let schedules = loadSchedules(); // Load existing schedules from the file

function loadSchedules() {
  try {
    const data = fs.readFileSync('schedules.json', 'utf8');
    const parsedSchedules = JSON.parse(data);
    
    // Reconstruct cron jobs
    parsedSchedules.forEach(schedule => {
      schedule.tasks = schedule.cronTimes.map(pattern => {
        return cron.schedule(pattern, () => {
          console.log(`Running scheduled job: ${schedule.scheduleName}`);
        });
      });
    });

    return parsedSchedules;
  } catch (error) {
    console.error('Error reading schedules file:', error);
    return [];
  }
}


function AddSchedule(payload) {
  try {
    payload = JSON.parse(payload);
    console.log('Payload:', payload);

    const id = schedules.length + 1;
    const cronTimes = [];
    const tasks = [];
    const scheduleName = payload[6];

    const daysArray = (payload[5] === '*') ? '*' : getIndicesFromBinary(payload[5]);

    if (daysArray === '*') {
      const pattern = `${payload[2]} ${payload[3]} ${payload[0]} ${payload[1]} *`;

      if (!cron.validate(pattern)) {
        throw new Error(`Invalid cron pattern: ${pattern}`);
      }

      const task = cron.schedule(pattern, () => {
        console.log(`Running scheduled job every day`);
      });

      cronTimes.push(pattern);
      tasks.push(task);
    } else {
      daysArray.forEach(day => {
        const pattern = `${payload[2]} ${payload[3]} ${payload[0]} ${payload[1]} ${day}`;

        if (!cron.validate(pattern)) {
          throw new Error(`Invalid cron pattern: ${pattern}`);
        }

        const task = cron.schedule(pattern, () => {
          console.log(`Running scheduled job on day ${day}`);
        });

        cronTimes.push(pattern);
        tasks.push(task);
      });
    }

    const job = { id, scheduleName, cronTimes, tasks };
    schedules.push(job);
    saveSchedules(schedules);

    console.log(`Schedule "${scheduleName}" set for ${payload[5]} at ${payload[2]}:${payload[3]}`);
  } catch (error) {
    console.error('Error scheduling job:', error);
    console.log(`Error scheduling job: ${error.message}`);
  }

  getList();


}


function getIndicesFromBinary(v) {
  let mod = 0;
  let factor = 1;

  while (v > 0) {
    let d = v % 2;
    v = Math.floor(v / 2);
    mod += d * factor;
    factor *= 10;
  }


  mod = mod.toString();
  let indices = [];


  for (let i = mod.length - 1; i >= 0; i--) {
    if (mod[i] === "1") {
      indices.push((mod.length - 1) - i);
    }
  }

  return indices;
}


// Function to save schedules to a file
function saveSchedules(schedules) {
  try {
    // Create a copy of schedules without tasks to avoid circular references
    const schedulesToSave = schedules.map(schedule => ({
      id: schedule.id,
      scheduleName: schedule.scheduleName,
      cronTimes: schedule.cronTimes
    }));

    fs.writeFileSync('schedules.json', JSON.stringify(schedulesToSave, null, 2));
    console.log('Schedules saved successfully.');
  } catch (error) {
    console.error('Error writing schedules file:', error);
  }
}


function getList()
{
  const jobList = schedules.map(schedule => ({
    id: schedule.id,
    scheduleName: schedule.scheduleName,
    cronTimes: schedule.cronTimes
  }));

  sendCommandToDevice(public_topic,JSON.stringify(jobList));
}


function updateJob(payload,jobid)
{
  try{
  payload = JSON.parse(payload);
  const cronTimes = [];
  const tasks = [];
   const id = jobid;
   const scheduleName = payload[6];
 

   const scheduleIndex = schedules.findIndex(schedule => schedule.id == id);
  
  if (scheduleIndex === -1) {
 
   console.log(`Schedule with ID ${id} not found`)
  }
  const daysArray = (payload[5] === '*') ? '*' : getIndicesFromBinary(payload[5]);

  if (daysArray === '*') {
    const pattern = `${payload[2]} ${payload[3]} ${payload[0]} ${payload[1]} *`;

    if (!cron.validate(pattern)) {
      throw new Error(`Invalid cron pattern: ${pattern}`);
    }

    const task = cron.schedule(pattern, () => {
      console.log(`Running scheduled job every day`);
    });

    cronTimes.push(pattern);
    tasks.push(task);
  } else {
    daysArray.forEach(day => {
      const pattern = `${payload[2]} ${payload[3]} ${payload[0]} ${payload[1]} ${day}`;

      if (!cron.validate(pattern)) {
        throw new Error(`Invalid cron pattern: ${pattern}`);
      }

      const task = cron.schedule(pattern, () => {
        console.log(`Running scheduled job on day ${day}`);
      });

      cronTimes.push(pattern);
      tasks.push(task);
    });

  }
   // Clear existing tasks
   schedules[scheduleIndex].tasks.forEach(task => task.stop());
    
   // Update schedule
   schedules[scheduleIndex].scheduleName = scheduleName;
   schedules[scheduleIndex].cronTimes = cronTimes;
   schedules[scheduleIndex].tasks = tasks;

   saveSchedules(schedules);

  
   console.log(`Schedule updateded `)
 } catch (error) {

   console.log(`Error updating job: ${error.message}`)
 }

 getList();
 
}


function jobdelete(payload)
{
  payload = JSON.parse(payload);
  const scheduleIndex = schedules.findIndex(schedule => schedule.id == payload);

  if (scheduleIndex === -1) {
    return res.status(404).send(`Schedule with ID ${scheduleIndex} not found`);
  }

  // Stop all tasks for the schedule
  schedules[scheduleIndex].tasks.forEach(task => task.stop());

  // Remove the schedule
  schedules.splice(scheduleIndex, 1);
  saveSchedules(schedules);


  console.log(`Schedule with ID ${scheduleIndex} deleted`);

  getList();

}



app.listen(3000, () => {
  console.log('Cron Job API listening on port 3000');
});

