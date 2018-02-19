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
            app.atRoom = arg.room;
            if (app.userId === arg.user) { //the one who join
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
            app.confirm.show = true;
            app.confirm.message = 'a user disconnected :('
            app.ready = false;
            app.atRoom = arg;
            break;
    }
})
socket.on('chat', function(mes) {
    let index = app.members_room.indexOf(mes.id);
    if(app.setting.chat===false)
        app.chatMesUnread+=1;
    mes.style = app.style[index];
    app.messages.push(mes);
})
socket.on('reject', function(e) {
    alert(e)
})
//----------GAME-----------------------
socket.on('card event', function(name, arg) {
    switch (name) {
        case 'start':
            app.confirm.show = false;
            app.Game=arg;
            break;
        case 'play':
            document.getElementById('sound-play').play()
            if(app.countDown.show)
                app.countDown.show=false;
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
        case 'game end':
            app.confirm.show = true;
            app.confirm.final = true;
            app.ready = false;
            app.confirm.message = 'Game End'
            app.atRoom = arg;
            break;
        case 'notification':
            notificate(arg)
            break;
        case 'countDown':
            document.getElementById('sound-count').play()
            app.countDown.show=true;
            app.countDown.count=arg;
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
        create_invalid:'',
        denied: {
            show: false,
            message: ''
        },
        roomSetting: {
            name: '',
            maxSets: 10,
            maxScore: 500,
            time:30,
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
        chatMesUnread:0,
        messages: [],
        chatMessage: '',
        //-------GAME-----------------------
        Game: {},
        notification: '',
        confirm:{
            show:false,
            message:'',
            final:false
        },
        countDown:{
            show:false,
            count:0
        },
        setting:{
            chat: false,
            mute:0.6
        },
        style:['black', 'blue', 'red', 'white']
    },
    methods: {
        enter: function(id) {
            socket.emit('room event', 'join', id)
        },
        createRoom: function(e) {
            e.preventDefault()
            var input = this.roomSetting.name;
            if(input.trim() === ''){
                this.create_invalid='name is empty.'
            } else if(input.length>=12){
                this.create_invalid='over 12 characters.'
            } else if(this.roomSetting.maxSets>100||this.roomSetting.maxSets<1){
                this.create_invalid='Max Sets should between 1 and 99';
            } else if(this.roomSetting.time>120||this.roomSetting.time<20){
                this.create_invalid='Time Limit should between 30 and 120';
            } else if(this.roomSetting.maxScore>2000||this.roomSetting.maxScore<250){
                this.create_invalid='Score should between 250 and 2000';
            }else{
                socket.emit('room event', 'create', {
                    roomName:input,
                    maxSets: this.roomSetting.maxSets,
                    maxScore: this.roomSetting.maxScore,
                    time:this.roomSetting.time
                });
            }
        },
        leaveRoom: function() {
            socket.emit('room event', 'leave', this.atRoom.id)
        },
        backToRoom: function(){ //reset Data
            this.Game = {};
            this.content = 'room';
            this.confirm.show=false;
            this.confirm.final = false;
            this.countDown.show = false;
        },
        sendMes: function(e) {
            e.preventDefault()
            if (this.chatMessage.trim() === '')
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
        },
        sound:function(){
            if(this.setting.mute)
                this.setting.mute=0;
            else
                this.setting.mute=0.6;
            document.getElementById('sound-count').volume = this.setting.mute;
            document.getElementById('sound-play').volume = this.setting.mute;
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
        members_notactive : function(){
            var ary = [];
            this.members_lob.forEach(function(m){
                ary.push(m<4)
            })
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
            let index=88;
            if (this.members_game) {
                active = this.members_game.find(function(p,i) {
                    if(p.status === 'play'){
                        index=i;
                        return true
                    }
                    return false;
                })
            }
            if (active!==undefined){
                active.reindex = index;
                return active
            }
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