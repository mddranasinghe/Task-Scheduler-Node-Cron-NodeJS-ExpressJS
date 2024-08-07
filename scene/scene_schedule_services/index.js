const cron = require('node-cron');
const fs = require('fs-extra');
const mqtt = require('mqtt');

var jobs = {},


tasks = [],task=0,payload,topic
// MQTT Broker details

company_code='v2jlcwytpqaufx',

subscribe_topic = company_code+'/scene/#',
publish_topic=company_code+"/scene/timers",


mqttBroker = 'ws://home.onesmartapi.com:1884/mqtt',
userName = 'dinuka',
password = 'dinuka',
mqttOptions = {
  clientId: `mqtt_${Math.floor(Math.random() * 1000)}`,
  username: userName,
  password: password,},

client = mqtt.connect(mqttBroker, mqttOptions);

client.on('connect', () => {
  console.log("Connected to MQTT Broker");
  client.subscribe(subscribe_topic, (err) => {
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
    } else if (topicsArray[3] === 'delete' && payload != 'all') {
      jobdelete(payload);
    // deleteAllSchedules();
    } 
  else if (topicsArray[3] === 'delete' && payload == 'all') {
    //jobdelete(payload);
   deleteAllSchedules();
  } 
  else if (topicsArray[3] === 'all' ) {
    //jobdelete(payload);
    deleteSceneSchedule(payload);
  } 
  
  else {
      //console.error("Unknown topic action:", topicsArray[3]);
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
//console.log(schedules);

function loadSchedules() {
  try {
    const data = fs.readFileSync('schedules.json', 'utf8');
    const parsedSchedules = JSON.parse(data);

    // Stop all existing tasks before reloading schedules........
    if (typeof global.currentTasks !== 'undefined') {
      global.currentTasks.forEach(task => task.stop());
    }
    global.currentTasks = [];

    // Reconstruct cron jobs for actived schedules only
    parsedSchedules.forEach(schedule => {
      if (!schedule.tasks) {
        schedule.tasks = []; 
      }
      

      if (schedule.active === 1) {
        schedule.tasks = schedule.cronTimes.map(pattern => {
          const task = cron.schedule(pattern, () => {

            const scene_id = schedule.id.split("_")[0];
            sendCommandToDevice(`${company_code}/scene/b2n/${scene_id}/set`, JSON.stringify(schedule.action));

            console.log(`Running scheduled job: ${schedule.scheduleName}`);

            if(schedule.type == 3){
            schedule.active = 4;
            }
            setTimeout(() => {
              saveSchedules(parsedSchedules);
            }, 1500);
          });

          global.currentTasks.push(task);
          return task;
        });
      } else {
        schedule.tasks = [];
      }
     
    });

    return parsedSchedules;
   
  } catch (error) {
    console.error('Error reading schedules file:', error);
    return [];
  }

}

function saveSchedules(schedules) {
  try {
    const schedulesToSave = schedules.map(schedule => ({
      id: schedule.id,
      active: schedule.active,
      type:schedule.type,
      action:schedule.action,
      scheduleName: schedule.scheduleName,
      sceneName: schedule.sceneName,
      sceneIcon: schedule.sceneIcon,
      cronTimes: schedule.cronTimes
    }));

    fs.writeFileSync('schedules.json', JSON.stringify(schedulesToSave, null, 2));
    console.log('Schedules saved successfully.');
    loadSchedules();
    getList();

 
  } catch (error) {
    console.error('Error writing schedules file:', error);
  }
}



function AddSchedule(payload) {
  try {
    payload = JSON.parse(payload);

    console.log('Payload:', payload);
    
    let maxSchId = schedules.length > 0 ? Math.max(...schedules.map(s => parseInt(s.id.split('_')[1], 10))) + 1 : 1;

    // Construct the new id using payload[0] and the new sch_id
    let newId = `${payload[0]}_${maxSchId}`,
    id=newId;
    const active = payload[1] === "1" ? 1 : 0,
    type =payload[2],
    action=payload[10],
    cronTimes = [],
    scheduleName = payload[11],
    sceneName= payload[12],
    sceneIcon= payload[13],
    daysArray = (payload[9] === '*') ? '*' : getIndicesFromBinary(payload[9]);
    
/*
    schedules.id.forEach(ids => {
      const [scene_id,sch_id] = ids.split('_');
      
    let  ids = schedules.length > 0 ? Math.max(...schedules.map(s => s.id)) + 1 : 1;        
    });

      id = `${payload[0]}_${id}`;*/




    if (daysArray === '*') {
      const pattern = `${payload[7]} ${payload[6]} ${payload[5]} ${payload[4]} *`;

      if (!cron.validate(pattern)) {
        throw new Error(`Invalid cron pattern: ${pattern}`);
      }

      task = cron.schedule(pattern, () => {
       // console.log(`Running scheduled job every day`);
      });

      cronTimes.push(pattern);
      tasks.push(task);
    } else {
      daysArray.forEach(day => {
        const pattern = `${payload[7]} ${payload[6]} ${payload[5]} ${payload[4]} ${day}`;

        if (!cron.validate(pattern)) {
          throw new Error(`Invalid cron pattern: ${pattern}`);
        }

        task = cron.schedule(pattern, () => {
        //  console.log(`Running scheduled job on day ${day}`);
        });
       

        cronTimes.push(pattern);
        tasks.push(task);
      });
    }

    const job = { id,active,type,action,scheduleName,sceneName,sceneIcon ,cronTimes, tasks };
    schedules.push(job);
    saveSchedules(schedules);

    console.log(`Schedule "${scheduleName}" set for ${payload[5]} at ${payload[2]}:${payload[3]}`);
    loadSchedules();
  } catch (error) {
    console.error('Error scheduling job:', error);
    console.log(`Error scheduling job: ${error.message}`);
  }

  //getList();


}

function updateJob(payload, jobid) {
  try {
    payload = JSON.parse(payload);

    const active = payload[1] === "1" ? 1 : 0,
    type =payload[2],
    action=payload[10],
     scheduleName = payload[11],
     sceneName= payload[12],
     sceneIcon= payload[13],
     cronTimes = [],
     scheduleIndex = schedules.findIndex(schedule => schedule.id == jobid);
    if (scheduleIndex === -1) {
      console.log(`Schedule with ID ${jobid} not found`);
      return;
    }

    // Clear existing tasks
    schedules[scheduleIndex].tasks.forEach(task => task.stop());

    const daysArray = (payload[9] === '*') ? '*' : getIndicesFromBinary(payload[9]);

    if (daysArray === '*') {
      const pattern = `${payload[7]} ${payload[6]} ${payload[5]} ${payload[4]} *`;

      if (!cron.validate(pattern)) {
        throw new Error(`Invalid cron pattern: ${pattern}`);
      }

       task = cron.schedule(pattern, () => {
      //  console.log(`Running scheduled job: ${scheduleName}`);
      });

      cronTimes.push(pattern);
      tasks.push(task);
    } else {
      daysArray.forEach(day => {
        const pattern = `${payload[7]} ${payload[6]} ${payload[5]} ${payload[4]} ${day}`;

        if (!cron.validate(pattern)) {
          throw new Error(`Invalid cron pattern: ${pattern}`);
        }

         task = cron.schedule(pattern, () => {
         // console.log(`Running scheduled job: ${scheduleName} on day ${day}`);
        });

        cronTimes.push(pattern);
        tasks.push(task);
      });
    }

    // Update schedule
    schedules[scheduleIndex].active = active;
    schedules[scheduleIndex].type = type;
    schedules[scheduleIndex].action = action;
    schedules[scheduleIndex].scheduleName = scheduleName;
    schedules[scheduleIndex].sceneName = sceneName;
    schedules[scheduleIndex].sceneIcon = sceneIcon;
    schedules[scheduleIndex].cronTimes = cronTimes;
    schedules[scheduleIndex].tasks = tasks;

    saveSchedules(schedules);

    console.log(`Schedule updated: ${scheduleName}`);
  } catch (error) {
    console.log(`Error updating job: ${error.message}`);
  }
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




function getList() {
  const jobList = schedules.map(schedule => {
    // Group days with the same time pattern
    const cronGroups = {};

    schedule.cronTimes.forEach(cronTime => {
      const [minute, hour, date, month , dayOfWeek] = cronTime.split(' ');
      const timePattern = `${minute} ${hour} ${date} ${month}`;

      if (!cronGroups[timePattern]) {
        cronGroups[timePattern] = [];
      }

      cronGroups[timePattern].push(dayOfWeek);
    });

  
    const groupedCronTimes = Object.entries(cronGroups).map(
      ([timePattern, days]) => `${timePattern} ${days.join(',')}`
    );

    return {
      id: schedule.id,
      active: schedule.active,
      type:schedule.type,
      action:schedule.action,
      scheduleName: schedule.scheduleName,
      sceneName: schedule.sceneName,
      sceneIcon: schedule.sceneIcon,
      cronTimes: groupedCronTimes
    };
  });

  sendCommandToDevice(publish_topic, JSON.stringify(jobList));
}



function jobdelete(payload) {
  try {
    payload = JSON.parse(payload);
    const scheduleIndex = schedules.findIndex(schedule => schedule.id == payload);

    if (scheduleIndex === -1) {
      console.error(`Schedule with ID ${payload} not found`);
      return;
    }

    if (schedules[scheduleIndex].tasks) {
      schedules[scheduleIndex].tasks.forEach(task => task.stop());
    }

   
    schedules.splice(scheduleIndex, 1);
    
   
    saveSchedules(schedules);

    console.log(`Schedule with ID ${payload} deleted`);
  } catch (error) {
    console.error('Error deleting schedule:', error);
  }
}
// only for web appliction 
function deleteAllSchedules() {
  try {
  
    schedules.forEach(schedule => {
      if (schedule.tasks) {
        schedule.tasks.forEach(task => task.stop());
      }
    });
    schedules.length = 0;
    saveSchedules(schedules);

    console.log('All schedules deleted');
  } catch (error) {
    console.error('Error deleting all schedules:', error);
  }
}

function deleteSceneSchedule(payload) {
  try {
    payload = JSON.parse(payload);
 
    const matchingSchedules = schedules.filter(schedule => schedule.id.split('_')[0] == payload);
    
    if (matchingSchedules.length === 0) {
      console.error(`No schedules with ID ${payload} found`);
      return;
    }
    matchingSchedules.forEach(schedule => {
      if (schedule.tasks) {
        schedule.tasks.forEach(task => task.stop());
      }
    });

    schedules = schedules.filter(schedule => schedule.id.split('_')[0] != payload);


    saveSchedules(schedules);

    console.log(`Schedules with ID ${payload} deleted`);
  } catch (error) {
    console.error('Error deleting schedules:', error);
  }
}
setInterval(() => {
  schedules = loadSchedules();
}, 40000);
setInterval(getList, 60000);