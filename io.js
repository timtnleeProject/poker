const socket = require('socket.io');
const io_session = require('express-socket.io-session');
const debug = require('debug')('poker:io');
const getId = require('./modules/random');
const Game = require('./modules/game').Game;
const Player = require('./modules/game').Player;
let mode = process.env.NODE_ENV;
let session_middleware;
// let rooms = {

// };
//***************************************test
let rooms = {
    // abcde: {
    //     id: 'abcde',
    //     name: 'gg',
    //     host: '',
    //     members: {},
    //     status: 'waiting'
    // }
}
//***************************************test
let players = {};

function createIo(server, session) {
    let io = socket(server);
    session_middleware = io_session(session);
    all(io);
    lobby(io);
    return io;
}

function all(io) {
    io.use((socket, next) => {
        if (mode == 'production') { //reject cross site socket connect;
            debug(socket.handshake.headers);
            debug(mode)
            debug('auth')
        }
        next();
    })
    io.use(session_middleware);
    io.use((socket, next) => { //record users//denied same connection//authorize
        let user = socket.handshake.session.name;
        if (players[user])
            debug('this player already connected')
        if (user === undefined) {
            debug('no session')
            next(new Error('no session'))
            return;
        } else {
            players[user]= {};           
                 next()

            //***************************************test
            // players[user] = {
            //     atRoom: 'abcde'
            // }
            // next()
            //***************************************test
        }
    })
    io.on('connect', (socket) => {
        debug('a user connect')
        socket.on('error', (e) => {
            console.log('err')
        })
    })
}

function lobby(io) {
    let lobby = io.of('/lobby');
    lobby.use(session_middleware);
    lobby.on('connect', (socket) => {
        let user = socket.handshake.session.name;
        //***************************************test
        // socket.join('abcde')
        // rooms.abcde.members[user] = {
        //     name: user,
        //     status: false
        // }
        // lobby.to('abcde').emit('client room', 'join', rooms.abcde)
        // console.log(rooms)
        //***************************************test
        socket.emit('init room', rooms, user);
        socket.on('room event', (event, arg) => { //arg
            if (players[user] === undefined) {
                socket.emit('reject', '請重新整理')
                return
            }
            players[user].id = socket.id;
            if (event === 'create') {
                getId(5, rooms).then((id) => {
                    let newRoom = {
                        id: id,
                        name: arg,
                        host: user,
                        members: {},
                        status: 'waiting'
                    };
                    newRoom.members[user] = { // new member
                        name: user,
                        status: false
                    }
                    //紀錄
                    rooms[id] = newRoom;
                    players[user].atRoom = id;
                    lobby.emit('update room', 'new', newRoom)
                    socket.join(id)
                    lobby.to(id).send('you create a room')
                    socket.emit('client room', 'join', newRoom);
                })
            } else if (event === 'join') { //in this case arg is id
                let id = arg;
                let theRoom = rooms[id];
                if (theRoom === undefined)
                    return;
                if (Object.keys(theRoom.members).length === 4) { //room is full
                    socket.emit('reject', 'The room is full.');
                    return;
                }
                //紀錄
                theRoom.members[user] = { // new member
                    name: user,
                    status: false
                };
                players[user].atRoom = id;
                lobby.emit('update room', 'join', theRoom)
                socket.join(id)
                lobby.to(id).send('a player join the room')
                lobby.to(id).emit('client room', 'join', theRoom);
            } else if (event === 'leave') { //in this case arg is id
                if (players[user].atRoom !== undefined) {
                    leaveRoom(user,socket);
                    socket.emit('client room', 'leave')
                }
                console.log(rooms)
            } else if (event === 'ready') { //in this case $name is {id:,name:}
                let id = arg.id;
                let _user = arg.name;
                let room = rooms[id];
                if (room && room.members[_user]) {
                    room.members[_user].status = arg.ready;
                } else {
                    socket.emit('reject', '請重新整理')
                    return;
                }
                lobby.to(id).emit('client room', 'status', room.members[_user]);
                if (Object.keys(room.members).length !== 4)
                    return;
                let allReady = true;
                for (let i in room.members) {
                    if (room.members[i].status !== true) {
                        allReady = false;
                        break;
                    }
                }
                if (allReady) { //to game
                    room.status = 'playing';
                    lobby.emit('update room', 'join', room)
                    room.game = new Game({})
                    for (let i in room.members) {
                        //let member = room.members[i];
                        let p =new Player(room.members[i].name);
                        //players[i].player = ;
                        p.invalid = (e) => {
                            lobby.to(players[i].id).emit('card event', 'notification', e)
                        }
                        players[i].player=p;
                        //member.player = players[i].player;
                        room.game.join(players[i].player);
                    }
                    room.game.init();
                    room.game.start = () => {
                        room.game.wash()
                        room.game.licensing()
                        if (room.game.set === 0)
                            room.game.players[0].status = 'play';
                        lobby.to(id).emit('client room', 'start game', room.game)
                    }
                    room.game.actionReject = (p, mes) => {//to one
                        debug('gamer action reject')
                        let name = p.name;
                        let socketid = players[name].id;
                        lobby.to(socketid).emit('card event', 'notification', mes)
                    }
                    room.game.actionValid = function(p, c) {
                        let validate = true
                        if (this.inRound === 0) { //第一個出 缺門才能出愛心 //或是只剩愛心
                            if (c.suit === 'heart' && !this.isVoid){
                                let found = p.onhand.find((c) => {
                                    return c.suit !== 'heart';
                                })
                                if(found)
                                    validate = "Can't play Hearts now."
                            }
                        } else { //跟著出 缺門才能丟其他花色
                            if (c.suit != this.roundColor) {
                                let found = p.onhand.find((c) => {
                                    return c.suit === this.roundColor
                                })
                                if (found)
                                    validate = "You Still have " + this.roundColor;
                                else if (!this.isVoid)
                                    this.isVoid = true;
                            }
                        }
                        return validate
                    }
                    room.game.action = (p, c) => { //after ._action
                        lobby.to(id).emit('card event', 'play', { player: p, roundPlayed: room.game.roundPlayed })
                    }
                    room.game.roundEnd = function() { //before ._roundEnd
                        this.roundPlayed.sort(($a, $b) => {
                            let a = $a.card;
                            let b = $b.card;
                            let ac = (a.suit === this.roundColor) ? 1 : 0;
                            let bc = (b.suit === this.roundColor) ? 1 : 0;
                            console.log(this.roundColor)
                            return b.index * bc - a.index * ac
                        })

                        let biggest = this.roundPlayed[0];
                        lobby.to(id).emit('card event', 'notification', biggest.player.name + ' eats this round');
                        this.roundPlayed.forEach((played) => {
                            if (played.card.role !== 'normal')
                                biggest.player.ontable.push(played.card)
                        })
                        setTimeout(() => {
                            if(biggest.player.onhand.length!==0)
                                biggest.player.status = 'play';
                            lobby.to(id).emit('card event', 'round', room.game.players)
                        }, 1000)
                    }
                    room.game.setEnd = function() {
                        room.game.players.forEach((player) => { //計分
                            let score = 0;
                            let score_length = 0;
                            let mult = 1;
                            let pig = 0;
                            let sheet = 0;
                            player.ontable.forEach((card) => {
                                if (card.role === 'score') {
                                    score_length++;
                                    switch (card.value) {
                                        case 'A':
                                            score -= 50
                                            break;
                                        case 'K':
                                            score -= 40
                                            break;
                                        case 'Q':
                                            score -= 30
                                            break;
                                        case 'J':
                                            score -= 20
                                            break;
                                        case '4':
                                            score -= 10
                                            break;
                                        default:
                                            score -= parseInt(card.value)
                                            break;
                                    }
                                } else if (card.role === 'pig') {
                                    player.status = 'play';
                                    pig = -100
                                } else if (card.role === 'sheet') {
                                    sheet = 100;
                                } else if (card.role === 'double') {
                                    mult = 2;
                                }
                            })
                            if ((score_length === 13 && mult === 2) && (pig && sheet)) { //全吃 1000分
                                score = 1000;
                            } else {
                                if (score_length === 13) { //全吃紅心 豬羊變色 紅心正分
                                    score *= -1;
                                    pig *= -1
                                    sheet *= -1;
                                }
                                if (score_length === 0 && mult === 2) { //只吃梅花10=>50分
                                    score = 25;
                                }
                                score = (score + pig + sheet) * mult;
                            }
                            player.score += score;
                        })
                        console.log(`set: ${room.game.set}`)
                        if (!true) {
                            // lobby.to(id).emit('card event', 'notification', `set ${this.set} end`);
                            lobby.to(id).emit('card event', 'set',room.game.players)
                            setTimeout(room.game.start, 2000)
                        } else {
                            setTimeout(()=>{
                                leaveGame(id);
                                lobby.to(id).emit('client room', 'leave game',room)                                
                            },1500)                           
                        }
                    }
                    room.game.start()
                    // for (let i in room.members) {
                    //     let id = players[i].id;
                    //     lobby.to(id).emit('card event', 'start', players[i].player.onhand)
                    // }
                    lobby.to(id).emit('card event', 'start', room.game.players)
                }
            }
        })
        //----------------------GAME-------------------
        socket.on('action', (c) => {
            let player = players[user].player;
            player.action(c);
        })
        //---------------------------------------------
        socket.on('chat', (mes) => {
            let room = players[user].atRoom;
            lobby.to(room).emit('chat', {
                name: user,
                mes: mes
            })
        })
        socket.on('disconnect', () => {
            if (players[user] === undefined)
                return;
            if (players[user].atRoom !== undefined) {
                leaveRoom(user)
            } else if (players[user].atRoom === undefined) { // at lobby
                delete players[user]
            }
        })
    })

    function leaveRoom(user,socket) {
        let roomId = players[user].atRoom;
        let theRoom = rooms[roomId];
        delete theRoom.members[user];
        if (Object.keys(theRoom.members).length === 0) { //房間沒人
            delete rooms[roomId]
            lobby.emit('update room', 'delete', theRoom)
        } else {//房間有人
            lobby.to(roomId).emit('client room', 'others leave', theRoom)
            lobby.emit('update room', 'leave', theRoom)
        }
        if(socket)
            socket.leave(roomId)
        players[user] = {};
    }

    function leaveGame(roomName){
        let theRoom = rooms[roomName];
        if(theRoom&&theRoom.game){
            for(let i in theRoom.members){
                let user=theRoom.members[i]
                user.status = false;
                delete players[user.name].player;
            }
            delete rooms[roomName].game
            theRoom.status='wait';
        }        
        console.log(rooms)
        console.log(players)
    }
}

module.exports = createIo;