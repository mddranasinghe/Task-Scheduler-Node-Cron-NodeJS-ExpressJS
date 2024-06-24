const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors'); 
const app = express();

app.use(bodyParser.json());
app.use(cors()); 
const jobs = {};

// File to store schedules
const SCHEDULE_FILE = path.join(__dirname, 'schedules.json');

// Function to load schedules from file
const loadSchedules = () => {
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
    });
    jobs[id] = { job, cronTime, task };
});

// Schedule a new job
app.post('/schedule', (req, res) => {
  const { id, cronTime, task } = req.body;
  if (jobs[id]) {
    return res.status(400).send('Job with this ID already exists.');

  }

  const job = cron.schedule(cronTime, () => {
    console.log(`Running task for job ${id}: ${task}`);
    //document.getElementById('box').innerHTML=`Task ID: ${id}, Task: ${task}, Cron Time: ${cronTime}`;

  });

  jobs[id] = { job, cronTime, task };
  schedules.push({ id, cronTime, task });
  saveSchedules(schedules);

  res.status(201).send('Job scheduled.');
});

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
