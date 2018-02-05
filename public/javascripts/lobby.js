var socket = io('/lobby');

socket.on('message', function(mes) {
    console.log(`lobby: ${mes}`)
})
socket.on('init room', (rs, user) => {
    app.rooms = rs;
    app.user = user;
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
            Vue.set(app.atRoom.members, arg.name, arg);
            if (arg.name == app.user)
                app.ready = !app.ready
            break;
        case 'start game':
            if(app.content!=='game')
                app.content = 'game';
            //app.players = arg;
            app.Game = arg;
            //app.sets+=1;
            break;
        case 'leave game':
            if(app.content!=='room')
                app.content = 'room';
            app.ready=false;
            app.atRoom = arg;
            app.Game = {};
            //app.players = [];
            //app.sets=0;
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
            Vue.set(app.Game,'players',arg);
            break;
        case 'play':
            app.Game.players.find(function(p, i) {
                if (p.index === arg.player.index)
                    Vue.set(app.Game.players, i, arg.player)
            })
            Vue.set(app.Game,'roundPlayed',arg.roundPlayed)
            // app.roundPlayed = arg.roundPlayed;
            break;
        case 'round':
            Vue.set(app.Game,'roundPlayed',[])
            Vue.set(app.Game,'players',arg);
            //app.roundPlayed = []
            //app.players = arg;
            break;
        case 'set':
            Vue.set(app.Game,'players',arg);
            //app.players = arg;
            break;
        case 'notification':
            app.notification = arg
            alert(arg)
            break;
    }
})
socket.on('invalid', function(e) {
    alert(e)
})
//---------Vue--View-----------
var app = new Vue({
    el: '#app',
    data: {
        place: 'lobby',
        user: null,
        rooms: {},
        roomName: '',
        roomSetting : {
            name:'',
            maxSets:10,
            maxScore:1000,
            show:false
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
        Game:{},
        players: [],
        roundPlayed: [],
        sets:0,
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
            var arg = { id: this.atRoom.id, name: this.user, ready: !this.ready }
            socket.emit('room event', 'ready', arg);
        }, //--------------GAME
        action: function(card) {
            socket.emit('action', card)
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
                if (p.name === this.user)
                    point = i;
            })
            let f = ary.slice(0, point)
            let r = ary.slice(point, 4)
            return r.concat(f)
        },
        roundPlayed_game: function() {
            let point;
            this.members_game.forEach((m,i)=>{
                this.roundPlayed.forEach((played)=>{
                    if(m.index===played.player.index)
                        played.index=i;
                })                
            })
            return this.roundPlayed
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