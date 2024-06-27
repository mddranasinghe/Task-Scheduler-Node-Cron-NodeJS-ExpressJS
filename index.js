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
const top = 'node/bsa/+/+/+';

// MQTT Broker details

const mqttBroker = 'ws://home.onesmartapi.com:1884/mqtt'; 
const userName = 'dinuka';
const password = 'dinuka';

const mqttOptions = {
  clientId: `mqtt_${Math.floor(Math.random() * 1000)}`,
  username: userName,
  password: password,

};

// Connect to MQTT Broker

const client = mqtt.connect(mqttBroker, mqttOptions);

client.on('connect', () => {
  console.log("Connected to MQTT Broker");
  client.subscribe(top, (err) => {
    if (err) {
      console.error("Subscription error:", err);
    } else {
      console.log("Subscribed to topic 'node/bsa/+/+/+'");
    }
  });
});

client.on('message', (topic, message) => {
 // console.log(`Message Arrived: ${message.toString()} on Topic: ${topic}`);
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
   // console.log(`sendCommandToDevice: ${topic}, Payload: ${payload}`);
    client.publish(topic, payload);
  }
}


// File to store schedules
//const SCHEDULE_FILE = path.join(__dirname, 'schedules.json');

// Function to load schedules from file
/*const loadSchedules = () => {
    try {
        const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// Function to save schedules to file
const saveSchedules = (schedules) => {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
};

// Schedule storage
let schedules = loadSchedules();



// Schedule tasks from the loaded schedules
schedules.forEach(({ id, cronTime, task }) => {
    const job = cron.schedule(cronTime, () => {
        console.log(`Task ID: ${id}, Task: ${task}, Cron Time: ${cronTime}`);  
       // sendCommandToDevice('node/bsa/b2n/homeCorners/inching/set/1','1,180');
        //node/bsa/b2n/homeCorners/sw/set
    });
    jobs[id] = { job, cronTime, task };
    console.log(jobs['job1']);
});*/



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

function saveSchedules(schedules) {
  try {
    // Create a copy of schedules without tasks to avoid circular references
    const schedulesToSave = schedules.map(schedule => ({
      id: schedule.id,
      scheduleName: schedule.scheduleName,
      cronTimes: schedule.cronTimes
    }));

    fs.writeFileSync('schedules.json', JSON.stringify(schedulesToSave, null, 2));
  } catch (error) {
    console.error('Error writing schedules file:', error);
  }
}

// Schedule a new job
app.post('/schedule', (req, res) => {
  const { scheduleName, days, scheduleTime } = req.body;
  console.log('Body:', req.body);
  const [hour, minute] = scheduleTime.split(':');
  const daysArray = days.split(',').map(day => day.trim());
  
  try {
    const id = schedules.length + 1;
    const cronTimes = [];
    const tasks = [];
    
    daysArray.forEach(day => {
      const pattern = `${minute} ${hour} * * ${day}`;
      
      if (!cron.validate(pattern)) {
        throw new Error(`Invalid cron pattern: ${pattern}`);
      }

      const task = cron.schedule(pattern, () => {
        console.log(`Running scheduled job: ${scheduleName} on day ${day}`);
      });

      cronTimes.push(pattern);
      tasks.push(task);
    });

    const job = { id, scheduleName, cronTimes, tasks };
    schedules.push(job);
    saveSchedules(schedules);

    res.send(`Schedule "${scheduleName}" set for ${days} at ${scheduleTime}`);
  } catch (error) {
    console.error('Error scheduling job:', error);
    res.status(400).send(`Error scheduling job: ${error.message}`);
  }
});
  /*jobs[id] = { job, cronTime, task };
  schedules.push({ id, cronTime, task });
  saveSchedules(schedules);

  res.status(201).send('Job scheduled.');
});*/




// Update an existing job
app.put('/jobs/:id', (req, res) => {
  const { id } = req.params;
  const { cronTime, task } = req.body;
  const jobRecord = jobs[id];
  if (!jobRecord) {
    return res.status(404).send('Job not found.');
  }

  // Stop the old job
  jobRecord.job.stop();

  // Create and start the new job
  const newJob = cron.schedule(cronTime, () => {
    console.log(`Running task for job ${id}: ${task}`);
  });

  // Update the job record
  jobs[id] = { job: newJob, cronTime, task };

  // Update the schedules array and save it
  const index = schedules.findIndex(schedule => schedule.id === id);
  if (index !== -1) {
    schedules[index] = { id, cronTime, task };
    saveSchedules(schedules);
  }

  res.send('Job updated.');
});

// Cancel a job
app.delete('/cancel/:id', (req, res) => {
  const { id } = req.params;
  const jobRecord = jobs[id];
  if (!jobRecord) {
    return res.status(404).send('Job not found.');
  }

  // Debugging
  console.log('Job record:', jobRecord);

  jobRecord.job.stop();
  delete jobs[id];

  // Update the schedules array and save it
  schedules = schedules.filter(schedule => schedule.id !== id);
  saveSchedules(schedules);

  res.send('Job canceled.');
});

// Get list of all jobs
app.get('/jobs', (req, res) => {
  const jobList = Object.keys(jobs).map(id => ({
    id,
    cronTime: jobs[id].cronTime,
    task: jobs[id].task
  }));
  res.status(200).json(jobList);
});

// Get details of a specific job
app.get('/jobs/:id', (req, res) => {
  const { id } = req.params;
  const jobRecord = jobs[id];
  if (!jobRecord) {
    return res.status(404).send('Job not found.');
  }

  res.status(200).json({
    id,
    cronTime: jobRecord.cronTime,
    task: jobRecord.task
  });
});

// Partially update a job
app.patch('/jobs/:id', (req, res) => {
  const { id } = req.params;
  const { cronTime, task } = req.body;
  const jobRecord = jobs[id];
  if (!jobRecord) {
    return res.status(404).send('Job not found.');
  }

  if (cronTime) {
    // Stop the old job if the cronTime is being updated
    jobRecord.job.stop();

    // Create and start the new job with the updated cronTime
    const newJob = cron.schedule(cronTime, () => {
      console.log(`Running task for job ${id}: ${task || jobRecord.task}`);
    });

    // Update the cronTime in the job record
    jobRecord.job = newJob;
    jobRecord.cronTime = cronTime;
  }

  if (task) {
    // Update the task in the job record
    jobRecord.task = task;
  }

  res.send('Job partially updated.');
});

app.listen(3000, () => {
  console.log('Cron Job API listening on port 3000');
});
















