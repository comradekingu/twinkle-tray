let isDev = false
const ddcci = require("@hensm/ddcci");

let WmiClient = false
var wmi = false

let monitors = []
let monitorNames = []

  function makeName(monitorDevice, fallback) {
    if(monitorNames[monitorDevice] !== undefined) {
      return monitorNames[monitorDevice]
    } else {
      return fallback;
    }
  }


async function refreshMonitors() {
    let foundMonitors = []
  let local = 0

  // First, let's get DDC/CI monitors. They're easy.
  ddcci._refresh()
  const ddcciMonitors = ddcci.getMonitorList()

  for (let monitor of ddcciMonitors) {
    try {
      const deviceID = monitor.substr(0, monitor.indexOf("\\\\.\\DISPLAY"))
      foundMonitors.push({
        name: makeName(deviceID, `Display ${local + 1}`),
        id: monitor,
        device: deviceID,
        num: local,
        localID: local,
        brightness: ddcci.getBrightness(monitor),
        type: 'ddcci',
        min: 0,
        max: 100
      })
    } catch(e) {

    }
    local++
  }

  // Next, let's request WMI monitors.
  // This part is a pain in the ass because of how finicky WMI queries/clients are.
  // We just return an empty array if anything goes wrong.

  let wmiMonitors = await new Promise((resolve, reject) => {
    try {
      wmi.query('SELECT * FROM WmiMonitorBrightness', function (err, result) {
        let out = []
        if (err != null) {
          resolve([])
        } else if (result) {
          let local = 0
          for (let monitor of result) {
            out.push({
              name: makeName(monitor.InstanceName, `Display ${local + 1}`),
              id: monitor.InstanceName,
              device: monitor.InstanceName,
              num: local,
              localID: local,
              brightness: monitor.CurrentBrightness,
              type: 'wmi',
              min: 0,
              max: 100
            })
            local++
          }
          resolve(out)
        } else {
          resolve([])
        }
      });

    } catch (e) {
      debug.log(e)
      resolve([])
    }
  })

  // Add WMI monitors, if available

  if (wmiMonitors && wmiMonitors.length > 0) {
    for (mon of wmiMonitors) {
      foundMonitors.push(mon)
      local++
    }
  }
  process.send({ type: "monitors", payload: foundMonitors })

}

process.on('message', (data) => {
    if(data.type == "request") {
      refreshMonitors()
    } else if(data.type == "isDev") {
      isDev = data.payload
      if(data.payload) {
        WmiClient = require('wmi-client');
      } else {
        WmiClient = require(path.join(app.getAppPath(), '../app.asar.unpacked/node_modules/wmi-client'));
      }
      wmi = new WmiClient({
        host: 'localhost',
        namespace: '\\\\root\\WMI'
      });
    }
    
})