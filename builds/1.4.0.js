const options = {
  'gun': '0',
  'color': '0',
  'armor': '0'
}

const svPacketTypes = {
  'ping': 1,
  'spawn': 2,
  'stateUpdate': 3,
  'kicked': 4,
  'joined': 5,
  'accountExists': 6,
  'accountExists2': 7,
  'loggedIn': 8,
  'dbOffline': 9,
  'loggedOut': 10,
  'alreadyLoggedIn': 11,
  'invalidCreds': 12,
  'playerJoinScreen': 13,
  'playerUpdate': 14,
  'playerExitScreen': 15,
  'objectJoinScreen': 16,
  'objectExitScreen': 17,
  'gamemode': 18
}

const clPacketTypes = {
  'ping': 1,
  'spawn': 2,
  'logout': 6,
  'login': 7,
  'register': 8,
  'connect': 9,
  'keydown': 10,
  'keyup': 11
}

const keyCodes = {
  'mouse': 0,
  'left': 1,
  'right': 2,
  'up': 3,
  'down': 4,
  'space': 5,
  'reload': 6
}

var Game;
var serverList;
var images = []
var btn = getElem('button-play')
var mouseDist = 0
var j40 = {
  "x" : 0,
  "y" : 0
}

class game {
  constructor() {
    this.player = createPlayer()
    this.socket = null
    this.canvas = {
      'elem': getElem("canvas"),
      'ctx': getElem("canvas").getContext("2d"),
      'spdX': 0,
      'spdY': 0,
      'x': 0,
      'y': 0
    }
    this.extra = {
      'upgradeAnim': {
        'transparency': 0,
        'direction': 'down'
      },
      'mouse': [0, 0],
      'lastClick': {
        "x": 0,
        "y": 0
      },
      'selectingPerk': {
        1: false,
        2: false,
        3: false
      },
      'showNames': true,
      'msgQueue': []
    }
  }
  spawn() {
    if (this.player.spawned || this.player.spawning) return;
    if (this.socket.connected) {
      this.player.spawning = true
      var buf = new ArrayBuffer(4)
      var dv = new DataView(buf)
      dv.setUint8(0, clPacketTypes.spawn)
      dv.setUint8(1, parseInt(options.gun))
      dv.setUint8(2, parseInt(options.color))
      dv.setUint8(3, parseInt(options.armor))
      this.socket.send(buf)
    }
  }
}

function initializeGame() {
  Game = new game()
  preload('./assets/img/hud-hit.png')
  var ca = '.'
  Game.connectingAnimationLoop = setInterval(() => {
    if (ca.length > 3) ca = '.'
    btn.innerHTML = `Connecting${ca}`
    ca += '.'
  }, 500)
  changeColor(options.color)
  changeArmor(options.armor)
  setTimeout(() => {
    getServers().then(servers => {
      checkPing(servers)
    })
      .catch(error => {
        console.log(error)
        clearInterval(Game.connectingAnimationLoop)
        btn.style.fontSize = '29px'
        btn.style.letterSpacing = '1px'
        btn.innerHTML = 'Error fetching servers.'
        btn.style.backgroundPosition = '100%'
        btn.style.cursor = ''
        console.log('Error fetching servers.')
      })
  }, 500)
}

function createPlayer() {
  return {
    'spawned': false,
    'spawning': false,
    'gamemode': null,
    'name': null,
    'vip': null,
    'id': null,
    'x': null,
    'y': null,
    'spdX': null,
    'spdY': null,
    'vx': null,
    'vy': null,
    'hp': null,
    'hudHp': null,
    'dead': false,
    'invincible': null,
    'beingHit': false,
    'recentDmg': 0,
    'gun': null,
    'color': null,
    'armor': null,
    'hudArmor': null,
    'maxAmmo': null,
    'ammo': null,
    'mouseAngle': null,
    'playerAngle': null,
    'score': null,
    'hudScore': null,
    'kills': null,
    'level': null,
    'perks': {
      '1': null,
      '2': null,
      '3': null,
      '4': null
    },
    'inView': {
      'obstacles': new Array(2000).fill({}),
      'bullets': new Array(2000).fill({}),
      'players': new Array(120).fill({})
    },
    'gameInfo': {
      'mapSize': {
        'x': null,
        'y': null
      }
    }
  }
}

function getServers() {
  return fetch('https://api.nitrogem35.repl.co/servers')
    .then(json => json.json())
}

function checkPing(servers) {
  if (!servers.error) {
    for (var i in servers) {
      console.log(`Testing ping to ${servers[i].city} ${servers[i].type}`)
      var url = servers[i].altUrl
      var socket = new WebSocket(`wss://${url}`)
      var pings = 0
      socket.timeout = setTimeout(() => {
        if (i + 1 == servers.length) {
          serverList = servers
          console.log('All ping servers were offline! Will now connect to the server at index 0')
          connect(1)
        }
      }, 5000)
      var buf = new ArrayBuffer(1);
      var dv = new DataView(buf);

      dv.setUint8(0, clPacketTypes.ping);

      socket.binaryType = 'arraybuffer'
      socket.onopen = function () {
        clearTimeout(socket.timeout)
        socket.send(buf)
        socket.pingStartTime = Date.now()
      }
      socket.onmessage = function (msg) {
        if (pings < 4) {
          if (new Uint8Array(msg.data)[0] == new Uint8Array(buf)[0]) {
            socket.send(buf)
            pings++
          }
        }
        else {
          servers[i].ping = (Date.now() - socket.pingStartTime) / 4
          socket.close()
          serverList = servers
          connect()
        }
      }
      socket.onerror = function () {
        console.log(`Failed to test ping to ${servers[i].city} ${servers[i].type}`)
      }
    }
  }
  else {
    clearInterval(Game.connectingAnimationLoop)
    btn.innerHTML = servers.error
    btn.style.backgroundPosition = '100%'
    btn.style.cursor = ''
    console.log(servers.error)
  }
}

function connect(pingFailed, url) {
  if (!url) {
    if (!pingFailed) {
      var ping = []
      var lowestLatency
      for (var i in serverList) {
        if (serverList[i].ping) ping.push(serverList[i].ping)
      }
      lowestLatency = serverList[ping.indexOf(Math.min(ping))]
    }
    else {
      lowestLatency = serverList[0]
    }
  }
  else {
    for (var i in serverList) {
      if (serverList[i].altUrl == url) {
        lowestLatency = serverList[i]
        btn.innerText = 'Reconnecting...'
        break
      }
    }
  }
  console.log(`Attempting connection to ${lowestLatency.city} ${lowestLatency.type}`)
  Game.socket = new WebSocket(`wss://${lowestLatency.altUrl}`)
  Game.socket.binaryType = 'arraybuffer'
  Game.socket.onopen = function () {
    console.log(`Connection to ${lowestLatency.city} ${lowestLatency.type} was successful`)
    if (url) btn.style.backgroundPosition = 'left'
    getElem("login").style.display = ''
    getElem("register").style.display = ''

    var connectBuf = new ArrayBuffer(1)
    var connectDv = new DataView(connectBuf)
    connectDv.setUint8(0, clPacketTypes.connect)
    Game.socket.send(connectDv)

    var buf = new ArrayBuffer(1)
    var dv = new DataView(buf)
    dv.setUint8(0, clPacketTypes.ping)

    Game.socket.onmessage = function (msg) {
      var opcode = new Uint8Array(msg.data)[0]
      var data = new Uint8Array(msg.data)
      switch (opcode) {
        case svPacketTypes.ping:
          Game.socket.send(buf)
          break
        case svPacketTypes.spawn:
          handleSpawn(msg.data, data)
          break
        case svPacketTypes.stateUpdate:
          handleStateUpdate(msg.data)
          break
        case svPacketTypes.kicked:
          break
        case svPacketTypes.joined:
          handleConnected(data, buf, lowestLatency)
          break
        case svPacketTypes.accountExists:
          handleAccExists(data)
          break
        case svPacketTypes.accountExists2:
          handleAccExists(data)
          break
        case svPacketTypes.loggedIn:
          handleLogin(data)
          break
        case svPacketTypes.dbOffline:
          handleDbOffline()
          break
        case svPacketTypes.loggedOut:
          handleLogout(data)
          break
        case svPacketTypes.alreadyLoggedIn:
          handleAlreadyLoggedIn()
          break
        case svPacketTypes.invalidCreds:
          handleInvalidCreds()
          break
        case svPacketTypes.gamemode: 
          changeGamemode(data)
          break
        default:
          if (!Game.socket.errMsgSent) console.log(
            `Packet type not recognized! If you think something's wrong, please do one of the following:
                      -DM a dev (nitrogem35#1661 or LightLord#4261 on Discord)
                      -Send me an email (nitrogem9@gmail.com)`.replace(/  +/g, '')
          )
          Game.socket.errMsgSent = true
          break
      }
    }
  }
  Game.socket.onclose = function () {
    console.log(`Disconnected from ${lowestLatency.city} ${lowestLatency.type}`)
    var url = Game.socket.url.split("://")[1].replace('/', '')
    if (Game.socket.registering) {
      getElem("register-btn").innerText = 'Register'
    }
    if (Game.socket.loggingIn) {
      getElem("login-boton-menu").innerText = 'Login'
    }
    Game.socket = null
    Game.player = createPlayer()
    Game.canvas.elem.style.display = 'none'
    getElem("login").style.display = 'none'
    getElem("register").style.display = 'none'
    getElem("loggedInTxt").style.display = 'none'
    getElem("logout-btn").style.display = 'none'
    displayMain()
    clearInterval(Game.connectingAnimationLoop)
    btn.style.background = 'linear-gradient(to right, #64ff5a 50%, #ffaf1a 50%)'
    btn.style.backgroundSize = '200% 100%'
    btn.style.backgroundPosition = 'right'
    btn.innerText = 'Rejoin'
    btn.onclick = function () {
      connect(undefined, url)
    }
  }
}

function handleConnected(data, buf, lowestLatency) {
  //once the server sends back a successful connection packet
  Game.socket.connected = true
  Game.socket.send(buf)
  clearInterval(Game.connectingAnimationLoop)
  btn.innerText = `Play [${lowestLatency.population}/${lowestLatency.max}]`
  btn.style.cursor = 'pointer'
  btn.onclick = function () {
    Game.spawn()
  }
}

function changeGamemode(data) {
  if(data[1] == 0) {
    Game.player.gamemode = 'FFA'
  }
}

function handleSpawn(data, uint8array) {
  var dv = new DataView(data)
  Game.player.id = dv.getUint8(1)
  Game.player.x = dv.getUint32(2) / 10
  Game.player.y = dv.getUint32(6) / 10
  Game.player.spdX = 0
  Game.player.spdY = 0
  Game.player.invincible = true
  Game.player.hp = dv.getUint8(10)
  Game.player.hudHp = Game.player.hp
  Game.player.gun = dv.getUint8(11)
  Game.player.armor = dv.getUint8(12)
  Game.player.hudArmor = Game.player.armor
  Game.player.color = dv.getUint8(13)
  Game.player.maxAmmo = dv.getUint8(14)
  Game.player.ammo = dv.getUint8(14)
  var isGuest = dv.getUint8(15)
  Game.player.gameInfo.mapSize.x = (dv.getUint32(16)) / 10
  Game.player.gameInfo.mapSize.y = (dv.getUint32(20)) / 10
  Game.player.vx = dv.getUint16(24)
  Game.player.vy = dv.getUint16(26)
  Game.player.radius = dv.getUint8(28)
  Game.player.kills = 0
  Game.player.score = 0
  Game.player.hudScore = Game.player.score
  if(Game.player.gamemode == 'FFA') Game.player.level = 0
  Game.player.playerAngle = 0
  var name = new TextDecoder().decode(uint8array.slice(29, uint8array.length))
  if (isGuest) Game.player.name = "Guest " + name
  else Game.player.name = name
  Game.player.spawned = true
  Game.player.spawning = false
  hideMain()
  adjustCanvas(Game.player)
  Game.canvas.x = Game.player.x - window.innerWidth / canvas.xratio / 2
  Game.canvas.y = Game.player.y - window.innerHeight / canvas.yratio / 2
  canvas.style.display = ''
  getElem('body').style.background = ''
  renderLoop()
}

function handleStateUpdate(data) {
  data = new DataView(data)
  Game.player.x = parseInt(data.getUint32(1))/10
  Game.player.y = parseInt(data.getUint32(5))/10
  Game.player.spdX = parseInt(data.getUint8(9))/10 - 12.8
  Game.player.spdY = parseInt(data.getUint8(10))/10 - 12.8
}


function makeInput(type, key) {
  var buf = new ArrayBuffer(2)
  var dv = new DataView(buf)
  if(type == 0) {
    dv.setUint8(0, clPacketTypes.keyup)
    dv.setUint8(1, key)
    return dv
  }
  else if(type == 1) {
    dv.setUint8(0, clPacketTypes.keydown)
    dv.setUint8(1, key)
    return dv
  } 
}

function adjustCanvas(player) { //scale everything based on screen size
  var x = player.vx
  var y = player.vy
  var ratio = x / y
  canvas.ratio = ratio
  var xratio = window.innerWidth / x
  var yratio = window.innerHeight / y
  canvas.xratio = xratio
  canvas.yratio = yratio
  var widthHeightRatio = window.innerWidth / window.innerHeight
  canvas.widthHeightRatio = widthHeightRatio
  if (widthHeightRatio > ratio) {
    yratio = xratio
  }
  else {
    xratio = yratio
  }
  canvas.rxratio = xratio
  canvas.ryratio = yratio
  canvas.x2 = window.innerWidth/2/xratio
  canvas.y2 = window.innerHeight/2/yratio
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  j40 = {
    "x" : window.innerWidth / xratio / 2,
    "y" : window.innerHeight / yratio / 2
  }
  Game.canvas.ctx.scale(xratio, yratio)
}

function renderLoop() {
  if(Game.socket.readyState != 1) return
  var frameStart = Date.now()
  //code goes here
  var ctx = Game.canvas.ctx
  //We need to clear the canvas before drawing again.
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  updateCanvas()
  drawGrid(ctx)
  drawHUD(ctx)
  drawBody(ctx, Game.player)
  for(var i in Game.player.inView.players) {
    var player = Game.player.inView.players[i]
    if(player.id) {
      drawBody(ctx, player)
    }
  }
  //end code
  var frameEnd = Date.now()
  var timeElapsed = frameEnd - frameStart
  setTimeout(renderLoop, 16 - timeElapsed)
}

function drawCrate() {

}

function drawLongCrate() {

}

function drawHUD(ctx) {
  ctx.font = "14px Orbitron"
  if (Game.socket.loggedIn) {
    ctx.fillStyle = "#167c12"
    ctx.fillText(`Logged in as ${Game.player.name}`, 5, 15)
  }
  else {
    ctx.fillStyle = "#666"
    ctx.fillText(`Playing as ${Game.player.name}`, 5, 15)
  }
  if (!Game.player.dead) {
    if (canvas.widthHeightRatio > 1 && canvas.widthHeightRatio < 2.6) {
      //in order to make losing/gaining hp, armor, and xp look smoother 
      //(instead of "snapping" to whatever the actual value is)
      if (Game.player.hudHp > Game.player.hp) {
        Game.player.hudHp--
      }
      else if (Game.player.hudHp < Game.player.hp) {
        Game.player.hudHp++
      }
      else if (Game.player.hudHp == Game.player.hp) {
        Game.player.hudHp = Game.player.hp
      }

      if (Game.player.hudArmor > Game.player.armor) {
        Game.player.hudArmor--
      }
      else if (Game.player.hudArmor < Game.player.armor) {
        Game.player.hudArmor++
      }
      else if (Game.player.hudArmor == Game.player.armor) {
        Game.player.hudArmor = Game.player.armor
      }

      if (Game.player.hudScore > Game.player.score) {
        Game.player.hudScore--
      }
      else if (Game.player.hudScore < Game.player.score) {
        Game.player.hudScore++
      }
      else if (Game.player.hudScore == Game.player.score) {
        Game.player.hudScore = Game.player.score
      }
      if(Game.player.recentDmg > 0) {
        ctx.drawImage(images[0], 0, 0, canvas.x2 * 2, canvas.y2 * 2)
      }
      ctx.globalAlpha = 0.5
      ctx.fillStyle = "#808080"
      ctx.fillRect(0.005 * canvas.x2, 1.925 * canvas.y2, 0.4 * canvas.x2, 0.067 * canvas.y2)
      ctx.fillStyle = "#7a7a7a"
      ctx.fillRect(0.01 * canvas.x2, 1.935 * canvas.y2, 0.39 * canvas.x2, 0.047 * canvas.y2)
      ctx.fillStyle = "#C30000"
      ctx.fillRect(0.01 * canvas.x2, 1.935 * canvas.y2, 0.39 / 100 * Game.player.hudHp * canvas.x2, 0.047 * canvas.y2)
      var isLosingHp = Boolean(Game.player.hp < Game.player.hudHp)
      if(isLosingHp) {
        //lets the player know how much hp they lost while preserving the smooth effect
        ctx.fillStyle = "#FF7F7F"
        ctx.fillRect(0.39 / 100 * ((Game.player.hp + 3) % 100) * canvas.x2, 1.935 * canvas.y2, 0.39 / 100 * (Game.player.hudHp - Game.player.hp) * canvas.x2, 0.047 * canvas.y2)
      }
      ctx.fillStyle = "white"
      ctx.font = "14px Orbitron"
      ctx.globalAlpha = 1
      ctx.fillText(`HP ${Game.player.hudHp}`, 0.012 * canvas.x2, 1.974 * canvas.y2)
      if(isLosingHp) {
        var diff = Game.player.hudHp - Game.player.hp
        ctx.globalAlpha = 0.8
        if(diff <= 10) {
          ctx.globalAlpha = diff*0.08
        }
        ctx.textAlign = "right"
        ctx.fillText(`(-${Math.round(diff/2)*2})`, 0.38 * canvas.x2, 1.974 * canvas.y2)
        ctx.textAlign = "start"
      }
      ctx.globalAlpha = 0.5
      ctx.fillStyle = "#808080"
      ctx.fillRect(0.005 * canvas.x2, 1.85 * canvas.y2, 0.4 * canvas.x2, 0.067 * canvas.y2)
      ctx.fillStyle = "#7a7a7a"
      ctx.fillRect(0.01 * canvas.x2, 1.86 * canvas.y2, 0.39 * canvas.x2, 0.047 * canvas.y2)
      ctx.fillStyle = "#545a38"
      ctx.fillRect(0.01 * canvas.x2, 1.86 * canvas.y2, 0.39 / 100 * Game.player.hudArmor * canvas.x2, 0.047 * canvas.y2)
      var isLosingArmor = Boolean(Game.player.armor < Game.player.hudArmor)
      if(isLosingArmor) {
        ctx.fillStyle = "#adadad"
        ctx.fillRect(0.39 / 100 * ((Game.player.armor + 3) % 100) * canvas.x2, 1.86 * canvas.y2, 0.39 / 100 * (Game.player.hudArmor - Game.player.armor) * canvas.x2, 0.047 * canvas.y2)
      }
      ctx.fillStyle = "white"
      ctx.font = "14px Orbitron"
      ctx.globalAlpha = 1
      ctx.fillText(`Armor ${Game.player.hudArmor}`, 0.012 * canvas.x2, 1.897 * canvas.y2)
      if(isLosingArmor) {
        var diff = Game.player.hudArmor - Game.player.armor
        ctx.globalAlpha = 0.8
        if(diff <= 10) {
          ctx.globalAlpha = diff*0.08
        }
        ctx.textAlign = "right"
        ctx.fillText(`(-${Math.round(diff/2)*2})`, 0.38 * canvas.x2, 1.897 * canvas.y2)
        ctx.textAlign = "start"
      }
      ctx.globalAlpha = 0.5
      var lvls
      if(Game.player.gamemode == 'FFA') {
        lvls = {
          0: [0, 100], 
          1: [100, 300],
          2: [300, 600],
          3: [600, 600]
        }
        var score = Game.player.score
        if(score < 100) Game.player.level = 0
        if(score >= 100 && score < 300) Game.player.level = 1
        if(score >= 300 && score < 600) Game.player.level = 2
        if(score >= 600) Game.player.level = 3
      }
      var lvl = Game.player.level
      var percent = 100 / (lvls[lvl][1] - lvls[lvl][0]) * (Game.player.hudScore - lvls[lvl][0])
      if(percent > 100) percent = 100
      else if(percent < 0) percent = 0
      ctx.fillStyle = "#808080"
      ctx.fillRect(0.41 * canvas.x2, 1.925 * canvas.y2, 1.175 * canvas.x2, 0.067 * canvas.y2)
      ctx.fillStyle = "#7a7a7a"
      ctx.fillRect(0.415 * canvas.x2, 1.934 * canvas.y2, 1.165 * canvas.x2, 0.05 * canvas.y2)
      ctx.fillStyle = "orange"
      ctx.fillRect(0.415 * canvas.x2, 1.934 * canvas.y2, 1.165 / 100 * percent * canvas.x2, 0.05 * canvas.y2)
      ctx.fillStyle = "white"
      ctx.font = "14px Orbitron"
      ctx.globalAlpha = 1
      ctx.fillText(`Score: ${Game.player.hudScore}`, 0.42 * canvas.x2, 1.973 * canvas.y2)
      ctx.textAlign = "right"
      ctx.fillText(`Kills: ${Game.player.kills}`, 1.575 * canvas.x2, 1.973 * canvas.y2)
      ctx.textAlign = "start"
      ctx.globalAlpha = 0.5
      ctx.fillStyle = "#808080"
      ctx.fillRect(1.59 * canvas.x2, 1.85 * canvas.y2, 0.0787 * canvas.x2, 0.14 * canvas.y2)
      ctx.fillRect(1.6737 * canvas.x2, 1.85 * canvas.y2, 0.0787 * canvas.x2, 0.14 * canvas.y2)
      ctx.fillRect(1.7574 * canvas.x2, 1.85 * canvas.y2, 0.0787 * canvas.x2, 0.14 * canvas.y2)
      ctx.fillStyle = "#7a7a7a"
      ctx.fillRect(1.595 * canvas.x2, 1.86 * canvas.y2, 0.0687 * canvas.x2, 0.12 * canvas.y2)
      ctx.fillRect(1.6787 * canvas.x2, 1.86 * canvas.y2, 0.0687 * canvas.x2, 0.12 * canvas.y2)
      ctx.fillRect(1.7624 * canvas.x2, 1.86 * canvas.y2, 0.0687 * canvas.x2, 0.12 * canvas.y2)
      var anim = Game.extra.upgradeAnim
      if(anim.direction == "up") {
        anim.transparency++
        if(anim.transparency >= 100) {
          anim.direction = "down"
        }
      }
      else {
        anim.transparency--
        if(anim.transparency <= 0) {
          anim.direction = "up"
        }
      }
      Game.extra.upgradeAnim = anim
      if(Game.player.level >= 1 && !Game.player.perks['1']) {
        var mouse = Game.extra.mouse
        var xr = canvas.rxratio
        var yr = canvas.ryratio
        var x2 = canvas.x2
        var y2 = canvas.y2
        if(
          mouse[0] / xr >= 1.595 * x2 && mouse[0] / xr <= 1.6637 * x2 &&
          mouse[1] / yr >= 1.86 * y2 && mouse[1] / yr <= 1.98 * y2
        ) {
          ctx.fillStyle = "yellow"
          ctx.fillRect(1.595 * x2, 1.86 * y2, 0.0687 * x2, 0.12 * y2)
        }
        
      }
      ctx.globalAlpha = 1
    }
  }
}

function drawBody(ctx, p) {
  var pos = getRelPos(Game.canvas, { 'x': p.x, 'y': p.y })
  //if(p.spdX != 0 || p.spdY != 0) {

  //}
  //else {
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 2
    drawCirc(ctx, pos.x, pos.y, p.radius)
    ctx.fillStyle = "#efeff5"
    ctx.fill()
  //}
}

function drawCirc(ctx, x, y, radius) {
  if(radius > 0) {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.stroke()
  }
}

function drawGrid(ctx) { //fill the grid based on the player's position
  var mx = Game.player.gameInfo.mapSize.x
  var my = Game.player.gameInfo.mapSize.y
  /*var p = {
    'x': Game.player.x - (window.innerWidth/2),
    'y': Game.player.y - (window.innerHeight/2)
  }*/
  var relTl = getRelPos(Game.canvas, { 'x': 0, 'y': 0 })
  var relBr = getRelPos(Game.canvas, { 'x': mx, 'y': my })
  ctx.fillStyle = '#efeff5'
  ctx.fillRect(0, 0, relBr.x + 5000, relBr.y + 5000)
  for (var i = 0; i <= my; i += 20) {
    drawLine(relTl.x, relTl.y + i, relBr.x, relTl.y + i, 1, ctx)
  }
  for (var i = 0; i <= mx; i += 20) {
    drawLine(relTl.x + i, relTl.y, relTl.x + i, relBr.y, 1, ctx)
  }
}

function drawLine(startX, startY, endX, endY, width, ctx) {
  ctx.strokeStyle = '#e3e3e8'
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.stroke()
}

function getRelPos(p1, p2) {
  return {
    "x": p2.x - p1.x,
    "y": p2.y - p1.y
  }
}

window.onresize = function () {
  if(Game) adjustCanvas(Game.player)
}

document.onmousemove = function(res) {
  if(Game && (Game.player.spawned || Game.player.dead)) {
    updatePlayerAngle(res)
    Game.extra.mouse = [res.clientX, res.clientY]
  }
}

document.onmousedown = function(res) {
  if(Game && (Game.player.spawned || Game.player.dead)) {
    if(Game.player.spawned) {
      if(res.which == 1) {
        Game.socket.send(makeInput(1, keyCodes.mouse))
      }
    }
    Game.extra.lastClick = {
      "x": res.clientX,
      "y": res.clientY
    }
  }
}

document.onmouseup = function(res) {
  if(Game && (Game.player.spawned || Game.player.dead)) {
    if(Game.player.spawned) {
      if(res.which == 1) {
        Game.socket.send(makeInput(0, keyCodes.mouse))
      }
    }
    Game.extra.lastClick = {
      "x": 0,
      "y": 0
    }
  }
}

document.onkeydown = function(res) {
  if(Game && (Game.player.spawned || Game.player.dead)) {
    var keys = [68, 83, 65, 87, 82, 32, 19, 45, 37, 38, 39, 40, 78, 13]
    if(keys.indexOf(res.keyCode) != -1) {
      res.preventDefault()
      if([65, 37].indexOf(res.keyCode) != -1) {
        Game.socket.send(makeInput(1, keyCodes.left))
      }
      if([68, 39].indexOf(res.keyCode) != -1) {
        Game.socket.send(makeInput(1, keyCodes.right))
      }
      if([83, 40].indexOf(res.keyCode) != -1) {
        Game.socket.send(makeInput(1, keyCodes.down))
      }
      if([87, 38].indexOf(res.keyCode) != -1) {
        Game.socket.send(makeInput(1, keyCodes.up))
      }
      if(res.keyCode == 32) {
        Game.socket.send(makeInput(1, keyCodes.space))
      }
      if(res.keyCode == 82) {
        Game.socket.send(makeInput(1, keyCodes.reload))
      }
      if(res.keyCode == 78) {
        Game.extra.showNames = !Game.extra.showNames
      }
    }

  }
}

document.onkeyup = function(res) {
  if(Game && (Game.player.spawned || Game.player.dead)) {
    var keys = [68, 83, 65, 87, 82, 32, 37, 38, 39, 40]
    if(keys.indexOf(res.keyCode) != -1) {
      res.preventDefault()
      if([65, 37].indexOf(res.keyCode) != -1) {
        Game.socket.send(makeInput(0, keyCodes.left))
      }
      if([68, 39].indexOf(res.keyCode) != -1) {
        Game.socket.send(makeInput(0, keyCodes.right))
      }
      if([83, 40].indexOf(res.keyCode) != -1) {
        Game.socket.send(makeInput(0, keyCodes.down))
      }
      if([87, 38].indexOf(res.keyCode) != -1) {
        Game.socket.send(makeInput(0, keyCodes.up))
      }
      if(res.keyCode == 32) {
        Game.socket.send(makeInput(0, keyCodes.space))
      }
      if(res.keyCode == 82) {
        Game.socket.send(makeInput(0, keyCodes.reload))
      }
    }
  }
}

function updatePlayerAngle(res) {
  var relPos = getRelPos(Game.canvas, {"x": Game.player.x, "y": Game.player.y})
  var a = relPos.x * canvas.xratio
  var r = relPos.y * canvas.yratio
  var fr = Math.atan2(r - res.clientY, a - res.clientX) * 180 / Math.PI + 180
  var pl = Math.round(fr + Math.asin(18 / Math.sqrt(Math.pow(a - res.clientX, 2) + Math.pow(r - res.clientY, 2))) * 180 / Math.PI)
  mouseDist = Math.sqrt(Math.pow(r - res.clientY, 2) + Math.pow(a - res.clientX, 2))
  Game.player.mouseAngle = Math.round(fr)
  if(pl > 360) {
    pl = pl - 360
  } 
  else if(!pl) {
    pl = fr
  }
  Game.player.playerAngle = pl
}

function updateCanvasAccel(p2) {
  var p1 = {
    'spdX': Game.canvas.spdX,
    'spdY': Game.canvas.spdY
  }
  if (p1.spdX < p2.x) {
    p1.spdX = p1.spdX + 0.1;
  } else {
    if (p1.spdX > p2.x) {
      p1.spdX = p1.spdX - 0.1;
    }
  }
  if (p1.spdY < p2.y) {
    p1.spdY = p1.spdY + 0.1;
  } else {
    if (p1.spdY > p2.y) {
      p1.spdY = p1.spdY - 0.1;
    }
  }
  if (p1.spdX > -0.1 && p1.spdX < 0.1) {
    p1.spdX = 0;
  }
  if (p1.spdY > -0.1 && p1.spdY < 0.1) {
    p1.spdY = 0;
  }
  p1.spdX = Math.round(p1.spdX * 10) / 10;
  p1.spdY = Math.round(p1.spdY * 10) / 10;
  Game.canvas.spdX = p1.spdX
  Game.canvas.spdY = p1.spdY
}

function updateCanvas() {
  if(Game.player.mouseAngle == undefined) {
    Game.player.mouseAngle = 0
  }
  var value = Game.player.mouseAngle * (Math.PI / 180)
  var cos = Math.cos(value)
  var sin = Math.sin(value)
  updateCanvasAccel({
    "x": Game.player.spdX,
    "y": Game.player.spdY
  })
  if (Game.canvas.spdX > -22 && Game.canvas.spdX < 22) {
    Game.canvas.x = mouseDist / 15 * cos + (Game.player.x - j40.x) - Game.canvas.spdX * 10;
  }
  if (Game.canvas.spdY > -22 && Game.canvas.spdY < 22) {
    Game.canvas.y = mouseDist / 15 * sin + (Game.player.y - j40.y) - Game.canvas.spdY * 10;
  }
}

function handleAccExists(data) {
  Game.socket.registering = false
  if (data[0] == svPacketTypes.accountExists) {
    regErr('An account with that username already exists.', 'regName')
    getElem("register-btn").innerText = 'Register'
  }
  else {
    regErr('An account with that email already exists.', 'email')
    getElem("register-btn").innerText = 'Register'
  }
}

function handleLogin(data) {
  Game.socket.loggedIn = true
  Game.socket.registering = false
  Game.socket.loggingIn = false
  getElem("register-btn").innerText = 'Register'
  getElem("login-boton-menu").innerText = 'Login'
  displayMain()
  getElem("register").style.display = 'none'
  getElem("login").style.display = 'none'
  getElem("logout-btn").style.display = ''
  var username = new TextDecoder().decode(data.slice(1, data.length))
  getElem("loggedInTxt").style.display = ''
  getElem("loggedInTxt").innerText = `Logged in as ${username}`
}

function handleLogout(data) {
  getElem("loggedInTxt").style.display = 'none'
  getElem("logout-btn").style.display = 'none'
  getElem("register").style.display = ''
  getElem("login").style.display = ''
}

function handleDbOffline() {
  if (Game.socket.registering) {
    Game.socket.registering = false
    regErr("The database is currently offline.", "register-btn", "Register")
  }
  if (Game.socket.loggingIn) {
    Game.socket.loggingIn = false
    regErr("The database is currently offline.", "login-boton-menu", "Login")
  }
}

function handleAlreadyLoggedIn() {
  Game.socket.loggingIn = false
  regErr("Your account is already logged in!", "login-boton-menu", "Login")
}

function handleInvalidCreds() {
  Game.socket.loggingIn = false
  regErr("The credentials you provided did not match our records.",
    "login-boton-menu", "Login")
}

function register() {
  if (Game.socket.registering) {
    return
  }
  Game.socket.registering = true
  getElem("register-btn").innerText = 'Registering...'
  var errorMsgs = document.querySelectorAll('#errorMessage')
  errorMsgs.forEach(function (node) {
    node.parentNode.removeChild(node);
  });
  var username = getElem("regName").value
  var email = getElem("email").value
  var password = getElem("regPassword").value
  var userError
  var emailError
  var passError
  if (!username) {
    regErr('The username field is required.', 'regName')
    userError = true
  }
  else if (/[^0-9a-z]/gi.test(username)) {
    regErr('Username may only contain letters/numbers.', 'regName')
    userError = true
  }
  else if (username.length < 3) {
    regErr('Username must be at least 3 characters.', 'regName')
    userError = true
  }
  else if (username.length > 14) {
    regErr('Username may not be longer than 14 characters.', 'regName')
    userError = true
  }
  if (!email) {
    regErr('The email field is required.', 'email')
    emailError = true
  }
  else if (!/^\S+@\S+\.\S+$/.test(email)) {
    regErr('The email address must be valid.', 'email')
    emailError = true
  }
  if (!password) {
    regErr('The password field is required.', 'regPassword')
    passError = true
  }
  else if (password.length < 6) {
    regErr('The password must be at least 6 characters.', 'regPassword')
    passError = true
  }
  if (!userError) clearErr(getElem('regName'))
  if (!emailError) clearErr(getElem('email'))
  if (!passError) clearErr(getElem('regPassword'))
  if (userError || emailError || passError) {
    getElem("register-btn").innerText = 'Register'
    Game.socket.registering = false
  }
  else {
    Game.socket.send('\x08' + username + '\x00' + email + '\x00' + password)
  }

}

function login() {
  if (Game.socket.loggingIn) {
    return
  }
  Game.socket.loggingIn = true
  getElem("login-boton-menu").innerText = 'Logging in...'
  var errorMsgs = document.querySelectorAll('#errorMessage')
  errorMsgs.forEach(function (node) {
    node.parentNode.removeChild(node);
  });
  var userError
  var passError
  var username = getElem("name").value
  var password = getElem("password").value
  if (!username) {
    regErr('The username field is required.', 'name')
    userError = true
  }
  else if (/[^0-9a-z]/gi.test(username) && !/^\S+@\S+\.\S+$/.test(username)) {
    regErr('Username/Email is invalid.', 'name')
    userError = true
  }
  else if (username.length < 3) {
    regErr('bruh, what did you expect', 'name')
    userError = true
  }
  else if (username.length > 64) {
    regErr('-_-', 'name')
    userError = true
  }
  if (!password) {
    regErr('The password field is required.', 'password')
    passError = true
  }
  else if (password.length < 6) {
    regErr('seriously smh', 'password')
    passError = true
  }
  if (!userError) clearErr(getElem('name'))
  if (!passError) clearErr(getElem('password'))
  if (userError || passError) {
    getElem("login-boton-menu").innerText = 'Login'
    Game.socket.loggingIn = false
  }
  else {
    Game.socket.send('\x07' + username + '\x00' + password)
  }
}
function logout() {
  var buf = new ArrayBuffer(1)
  var dv = new DataView(buf)
  dv.setUint8(0, clPacketTypes.logout)
  Game.socket.send(buf)
}
let backgroundBody="https://stats.takepoint.io/img/grid.png";
function changeColor(a) {
    a = a.slice(-1)
    var oldColorStyle = getElem(`color${options.color}`).style
    oldColorStyle.boxSizing = ""
    oldColorStyle.border = ""
    options.color = a
    var newColorStyle = getElem(`color${options.color}`).style
    newColorStyle.boxSizing = "border-box"
    newColorStyle.border = "5px solid black"
  }
  
  function changeArmor(a) {
    a = a.slice(-1)
    var oldArmorStyle = getElem(`armor${options.armor}`).style
    oldArmorStyle.boxSizing = ""
    oldArmorStyle.border = ""
    oldArmorStyle.borderRadius = ""
    options.armor = a
    var newArmorStyle = getElem(`armor${options.armor}`).style
    newArmorStyle.boxSizing = "border-box"
    newArmorStyle.border = "6px solid black"
    newArmorStyle.borderRadius = "2px"
  }
  
  function changeGun(a) {
    console.log(a)
  }
  
  let score=document.getElementsByClassName("plantilla-estilo-submenus")
  function displayMain() {
    getElem('main').style.display = ''
    getElem('title').style.display = ''
    getElem('guns-menu').style.display = 'none'
    getElem('flex-login').style.display = 'none'
    getElem('flex-register').style.display = 'none'
    getElem('body').style.background = `${backgroundBody}`
    getElem('overlay').style.display = 'none'
    getElem('main').style.backgroundColor = ''
    getElem('title').style.backgroundColor = ''
    getElem('guns-menu').style.backgroundColor = ''
    getElem('flex-login').style.backgroundColor = ''
    getElem('flex-register').style.backgroundColor = ''
    getElem('title').style.color = '#fff'
    score[0].style.display=''
    score[1].style.display=''
    getElem('contenedor-global').style.display = ''
  }
  
  function hideMain() {
    getElem('main').style.display = 'none'
    getElem('title').style.display = 'none'
    score[0].style.display='none'
    score[1].style.display='none'
  }
  
  function openLogin() {
    getElem('flex-login').style.display = ''
    getElem('flex-login').style.animation = 'openMenu .5s'
    getElem('flex-login').style.animationFillMode = 'forwards'
    getElem('overlay').style.display = ''
  }
  
  function closeLogin() {
    displayMain()
  }
  
  function openGuns() {
    hideMain()
    getElem('guns-menu').style.display = ''
    getElem('body').style.background = `${backgroundBody}`
    getElem('contenedor-global').style.display = 'none'
  }
  
  function closeGuns() {
    displayMain()
  }
  
  function openRegister() {
    getElem('flex-register').style.display = ''
    getElem('overlay').style.display = ''
    getElem('flex-register').style.animation = 'openMenu2 .5s'
    getElem('flex-register').style.animationFillMode = 'forwards'
  }
  
  function closeRegister() {
    displayMain()
  }
  
  function getElem(id) {
    return document.getElementById(id)
  }
  
  function setErr(elem) {
    elem.style.backgroundColor = '#F2DEDE'
  }
  
  function clearErr(elem) {
    elem.style.backgroundColor = ''
  }
  
  function regErr(text, id, dbOffline) {
    if (!dbOffline) setErr(getElem(id))
    else getElem(id).innerText = dbOffline
    getElem(id).insertAdjacentHTML('afterend',
      `<div id="errorMessage">${text}</div>`
    );
  }
  
  function preload() {
    for (var i = 0; i < arguments.length; i++) {
        images[i] = new Image();
        images[i].src = preload.arguments[i];
    }
  }
  
  function onLoad(ms) {
    clearInterval(load)
    loadingText.innerHTML = `Loaded (${ms}ms)`
    loadingText.style.animation = 'flash 1.8s'
    setTimeout(() => {
      loadingText.style.display = 'none'
      var titleDiv = getElem('title-div')
      var forceClick = getElem('force-click')
      titleDiv.style.display = ''
      setTimeout(() => { forceClick.style.display = '' }, 800)
      titleDiv.style.animation = 'moveTitleDown 1s'
      //getElem('main').style.display = ''
    }, 1750)
  }
  
  function loadMain() {
    var forceClick = getElem('force-click')
    var main = getElem('main')
    forceClick.style.animation = 'moveButtonOffscreen 1.2s'
    forceClick.style.animationFillMode = 'forwards'
    setTimeout(() => {
      forceClick.style.display = 'none'
      main.style.opacity = '0'
      main.style.display = ''
      window.scroll(0,0)
      main.style.animation = 'fadeIn 0.3s'
      main.style.animationFillMode = 'forwards'
      score[0].style.display=''
      score[1].style.display=''
      setTimeout(() => {
        main.style.opacity = 1
        main.style.animation = ''
      }, 300)
      initializeGame()
    }, 600)
  }
  function Modos(){
      if(backgroundBody == "https://stats.takepoint.io/img/grid.png"){
         backgroundBody = "#292a2d";
         getElem("modos").innerHTML="Normal Mode";
         getElem("body").style.background=`${backgroundBody}`
         getElem("title").style.textShadow="0px 0px";
      }
      else{
        backgroundBody = "https://stats.takepoint.io/img/grid.png";
        getElem("modos").innerHTML="Dark Mode";
        getElem("body").style.background=`url(${backgroundBody})`;
        getElem("title").style.textShadow="4px 4px #868686";
      }
  }
  window.addEventListener("resize", function(e){
    window.scroll(0,0)
});