var socket = io('/lobby');

socket.on('message', function(mes) {
    console.log(`lobby: ${mes}`)
})
socket.on('init room', function(rs, user) {
    app.rooms = rs;
    app.userId = user.id;
    app.userName = user.name;
})
socket.on('denied', function(mes) {
    Vue.set(app.denied, 'show', true);
    Vue.set(app.denied, 'message', mes);
})
socket.on('update room', function(event, room) { //lobby
    switch (event) {
        case 'new':
            Vue.set(app.rooms, room.id, room)
            break;
        case 'join':
            Vue.set(app.rooms, room.id, room)
            break;
        case 'leave':
            Vue.set(app.rooms, room.id, room)
            break;
        case 'delete':
            Vue.delete(app.rooms, room.id)
            break;
    }
})
socket.on('client room', function(event, arg) {
    switch (event) {
        case 'join':
            app.atRoom = arg;
            if (app.content !== 'room') { //the one who join
                app.content = 'room'
            }
            app.messages.push({ name: 'note', mes: 'a user enter the room', style: 'note' })
            break;
        case 'others leave':
            app.atRoom = arg
            app.messages.push({ name: 'note', mes: 'a user leave the room', style: 'note' })
            break;
        case 'leave':
            app.content = 'lobby'
            app.atRoom = {};
            app.messages = [];
            app.ready = false;
            break;
        case 'status':
            Vue.set(app.atRoom.members, arg.id, arg);
            if (arg.id == app.userId)
                app.ready = !app.ready
            break;
        case 'start game':
            if (app.content !== 'game')
                app.content = 'game';
            app.Game = arg;
            break;
        case 'leave game':
            if (app.content !== 'room')
                app.content = 'room';
            app.ready = false;
            app.atRoom = arg;
            app.Game = {};
            break;
    }
})
socket.on('chat', function(mes) {
    let style = ['black', 'blue', 'red', 'gray'];
    let index = app.members_room.indexOf(mes.name);
    mes.style = style[index];
    app.messages.push(mes);
})
socket.on('reject', function(e) {
    alert(e)
})
//----------GAME-----------------------
socket.on('card event', function(name, arg) {
    switch (name) {
        case 'start':
            app.Game=arg;
            break;
        case 'play':
            app.Game.players.find(function(p, i) {
                if (p.index === arg.player.index)
                    Vue.set(app.Game.players, i, arg.player)
            })
            Vue.set(app.Game, 'players', arg.game.players)
            Vue.set(app.Game, 'roundPlayed', arg.game.roundPlayed)
            break;
        case 'round':
            Vue.set(app.Game, 'roundPlayed', [])
            Vue.set(app.Game, 'players', arg);
            break;
        case 'set':
            Vue.set(app.Game, 'players', arg);
            break;
        case 'notification':
            notificate(arg)
            break;
    }
})
socket.on('invalid', function(e) {
    alert(e)
})

function notificate(mes) {
    app.notification = mes;
    let el = document.getElementById('notification');
    if (el === null)
        return;
    if (!el.classList.contains('show')) {
        el.classList.add('show');
        setTimeout(function() { el.classList.remove('show') }, 1000)
    }        
}
//---------Vue--View-----------
var app = new Vue({
    el: '#app',
    data: {
        place: 'lobby',
        userId: false,
        userName: false,
        rooms: {},
        denied: {
            show: false,
            message: ''
        },
        roomName: '',
        roomSetting: {
            name: '',
            maxSets: 10,
            maxScore: 1000,
            show: false
        },
        //atRoom: {},
        //***************test
        atRoom: {
            // id: 'abcde',
            // name: 'gg',
            // host: '',
            // members: {},
            // status: 'waiting'
        },
        content: 'lobby',
        //***************test
        ready: false,
        messages: [],
        chatMessage: '',
        //-------GAME-----------------------
        Game: {},
        notification: ''
    },
    methods: {
        enter: function(id) {
            socket.emit('room event', 'join', id)
        },
        createRoom: function(e) {
            e.preventDefault()
            var input = this.roomName;
            // var input = document.getElementById('roomName').value.trim(' ');
            if (input.trim(' ') !== '') {
                socket.emit('room event', 'create', input);
            }
        },
        leaveRoom: function() {
            socket.emit('room event', 'leave', this.atRoom.id)
        },
        sendMes: function(e) {
            e.preventDefault()
            if (this.chatMessage.trim(' ') === '')
                return;
            if (this.chatMessage.length >= 40) {
                this.chatMessage = this.chatMessage.slice(0, 40)
            }
            socket.emit('chat', this.chatMessage)
            this.chatMessage = '';
        },
        getReady: function() {
            var arg = { id: this.atRoom.id, name: this.userId, ready: !this.ready }
            socket.emit('room event', 'ready', arg);
        }, //--------------GAME
        action: function(card) {
            if(this.members_game[0].status==='play')
                socket.emit('action', card)
            else
                notificate('Not your turn')
        }
    },
    computed: {
        members_room: function() {
            return Object.keys(this.atRoom.members)
        },
        members_lob: function() {
            var ary = [];
            for (var i in this.rooms) {
                ary.push(Object.keys(this.rooms[i].members).length)
            }
            return ary
        },
        members_game: function() {
            let point;
            let ary = this.Game.players;
            ary.forEach((p, i) => {
                if (p.id === this.userId)
                    point = i;
            })
            let f = ary.slice(0, point)
            let r = ary.slice(point, 4)
            return r.concat(f)
        },
        roundPlayed_game: function() {
            let point;
            this.members_game.forEach((m, i) => {
                this.Game.roundPlayed.forEach((played) => {
                    if (m.index === played.player.index)
                        played.index = i;
                })
            })
            return this.Game.roundPlayed
        },
        activePlayer: function() {
            let active;
            if (this.Game.players) {
                active = this.Game.players.find(function(p) {
                    return p.status === 'play';
                })
            }
            if (active)
                return active
            else
                return '---'
        },
        scroll: function() {
            let fake = this.messages;
            let el_message = document.querySelector('.chat');
            if (el_message === null || el_message === undefined)
                return;
            setTimeout(function() {
                el_message.scrollTop = el_message.scrollHeight;
            }, 100)
            return 1;
        }
    }
})