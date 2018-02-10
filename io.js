const socket = require('socket.io');
const io_session = require('express-socket.io-session');
const debug = require('debug')('poker:io');
const getId = require('./modules/random');
const Game = require('./modules/game').Game;
const Player = require('./modules/game').Player;
const record = require('./modules/record')
let mode = process.env.NODE_ENV;
let disableSameDevice = process.env.device;
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
let players = record.sessionId;

function createIo(server, session) {
    let io = socket(server);
    session_middleware = io_session(session);
    //all(io);
    lobby(io);
    return io;
}

// function all(io) {
//     io.use((socket, next) => {
//         if (mode == 'production') { //reject cross site socket connect;
//             debug(socket.handshake.headers);
//             debug(mode)
//             debug('auth')
//         }
//         next();
//     })
//     io.use(session_middleware);
//     io.use((socket, next) => { //record users//denied same connection//authorize
//         let user = socket.handshake.session.name;
//         if (players[user]){
//             //debug('this player already connected')
//             if(disableSameDevice)
//                 socket._err='this player already connected';
//         } else if (user === undefined) {
//             //debug('no session')
//             socket._err='no session';
//             // next(new Error('no session'))
//             return;
//         } else {
//             players[user]= {};           
//             //***************************************test
//             // players[user] = {
//             //     atRoom: 'abcde'
//             // }
//             // next()
//             //***************************************test
//         }
//         next()
//     })
//     io.on('connect', (socket) => {
//         debug('a user connect')
//         socket.on('error', (e) => {
//             console.log('err')
//         })
//     })
// }

function lobby(io) {
    let lobby = io.of('/lobby');
    lobby.use(session_middleware);
    lobby.use((socket, next) => { //record users//denied same connection//authorize
        let user = socket.handshake.session.userId;
        let name = socket.handshake.session.userName;
        if (players[user]) {
            debug('this player already connected')
            let roomName = players[user].atRoom;
            if (disableSameDevice == 'yes') {
                if (roomName !== undefined && rooms[roomName].status === 'waiting') {
                    leaveRoom(user);
                    socket.emit('client room', 'leave')
                } else if (roomName !== undefined && rooms[roomName].status === 'playing') {
                    leaveGame(roomName);
                    leaveRoom(user)
                    socket.emit('client room', 'leave')
                }
                delete players[user];
                socket._err = 'You have been connected on this device. All your connections will be closed.';
            }
        } else if (user === undefined) {
            //debug('no session')
            socket._err = 'no session';
            // next(new Error('no session'))
            return;
        } else {
            players[user] = {
                name: name
            };
            //***************************************test
            // players[user] = {
            //     atRoom: 'abcde'
            // }
            // next()
            //***************************************test
        }
        next()
    })
    lobby.on('connect', (socket) => {
        if (socket._err) {
            debug(socket._err)
            socket.emit('denied', socket._err)
            return;
        }
        let user = socket.handshake.session.userId; //user:  Id
        let userName = socket.handshake.session.userName; //userName: name
        //***************************************test
        // socket.join('abcde')
        // rooms.abcde.members[user] = {
        //     name: user,
        //     status: false
        // }
        // lobby.to('abcde').emit('client room', 'join', rooms.abcde)
        // console.log(rooms)
        //***************************************test
        socket.emit('init room', rooms, { id: user, name: userName });
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
                        name: arg.roomName,
                        host: user,
                        members: {},
                        status: 'waiting',
                        maxScore: arg.maxScore,
                        time: arg.time,
                        maxSets: arg.maxSets
                    };
                    newRoom.members[user] = { // new member
                        id: user,
                        name: userName,
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
                    id: user,
                    name: userName,
                    status: false
                };
                players[user].atRoom = id;
                lobby.emit('update room', 'join', theRoom)
                socket.join(id)
                lobby.to(id).send('a player join the room')
                lobby.to(id).emit('client room', 'join', theRoom);
            } else if (event === 'leave') { //in this case arg is id
                if (players[user].atRoom !== undefined) {
                    leaveRoom(user, socket);
                    socket.emit('client room', 'leave')
                }
            } else if (event === 'ready') { //in this case .name is userName .id is RoomId
                let id = arg.id;
                let _user = arg.name;
                let room = rooms[id];
                if (room && room.members[_user]) {
                    room.members[_user].status = arg.ready;
                } else {
                    socket.emit('reject', 'Please Reload The page.')
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
                    room.game = new Game({
                        maxSets: room.maxSets,
                        maxScore: room.maxScore,
                        timeLimit: room.time
                    })
                    for (let i in room.members) {
                        //let member = room.members[i];
                        let p = new Player({ name: room.members[i].name, id: room.members[i].id });
                        //players[i].player = ;
                        p.invalid = (e) => {
                            lobby.to(players[i].id).emit('card event', 'notification', e)
                        }
                        players[i].player = p;
                        //member.player = players[i].player;
                        room.game.join(players[i].player);
                    }
                    //timer
                    let timer;
                    let timer2;
                    let isPlaying = () => room.game.players.find((p) => {
                        return p.status === 'play'
                    })
                    let startTimer = function() {
                        timer = setTimeout(() => { //字動出牌 
                            if (room.game === undefined)
                                return undefined;
                            let player = isPlaying()
                            let mes = player.name + ' overtime. Throw a card automatically.'
                            lobby.to(id).emit('card event', 'notification', mes)
                            room.game.autoPlay(player);
                        }, room.game.timeLimit);
                        timer2 = setTimeout(() => { //提醒
                            let player = isPlaying()
                            if (players[player.id] === undefined)
                                return;
                            let sessionId = players[player.id].id;
                            lobby.to(sessionId).emit('card event', 'notification', '10 secends left.')
                        }, room.game.timeLimit - 11000)
                    }
                    let clearTimer = function() {
                        clearTimeout(timer);
                        clearTimeout(timer2)
                    }
                    room.game.init();
                    room.game.start = () => {
                        room.game.wash()
                        room.game.licensing()
                        if (room.game.set === 0)
                            room.game.players[0].status = 'play';
                        lobby.to(id).emit('card event', 'start', room.game)
                        startTimer();
                    }
                    room.game.actionReject = (p, mes) => { //to one
                        debug('gamer action reject')
                        let pid = p.id;
                        let socketid = players[pid].id;
                        lobby.to(socketid).emit('card event', 'notification', mes)
                    }
                    room.game.actionValid = function(p, c) {
                        let validate = true
                        if (this.inRound === 0) { //第一個出 缺門才能出愛心 //或是只剩愛心
                            if (c.suit === 'heart' && !this.isVoid) {
                                let found = p.onhand.find((c) => {
                                    return c.suit !== 'heart';
                                })
                                if (found)
                                    validate = "Can't play Hearts now."
                            }
                        } else { //跟著出 缺門才能丟其他花色
                            if (c.suit != this.roundColor) {
                                let found = p.onhand.find((c) => {
                                    return c.suit === this.roundColor
                                })
                                if (found)
                                    validate = "You Still have " + this.roundColor;
                                else if (c.suit === 'heart' && !this.isVoid)
                                    this.isVoid = true;
                            }
                        }
                        return validate
                    }
                    room.game.action = (p, c) => { //after ._action
                        lobby.to(id).emit('card event', 'play', { player: p, game: room.game })
                        clearTimer()
                        if (room.game.inRound !== 4)
                            startTimer()
                    }
                    room.game.roundDelay = 1800;
                    room.game.roundEnd = function() { //before ._roundEnd
                        return new Promise((resolve, reject) => {
                            this.roundPlayed.sort(($a, $b) => {
                                let a = $a.card;
                                let b = $b.card;
                                let ac = (a.suit === this.roundColor) ? 1 : 0;
                                let bc = (b.suit === this.roundColor) ? 1 : 0;
                                return b.index * bc - a.index * ac
                            })

                            let biggest = this.roundPlayed[0];
                            lobby.to(id).emit('card event', 'notification', biggest.player.name + ' eats this round');
                            this.roundPlayed.forEach((played) => {
                                if (played.card.role !== 'normal')
                                    biggest.player.ontable.push(played.card)
                            })
                            setTimeout(() => {
                                if (biggest.player.onhand.length !== 0)
                                    biggest.player.status = 'play';
                                lobby.to(id).emit('card event', 'round', room.game.players)
                                startTimer()
                                debug('round end')
                                resolve()
                            }, room.game.roundDelay)
                        })
                    }
                    room.game.isEnd = function() {
                        if (this.set === this.maxSets)
                            return true;
                        let player = this.players.find((p) => {
                            return p.score >= this.maxScore || p.score <= this.maxScore * -1;
                        })
                        if (player)
                            return true
                        else
                            return false;
                    }
                    room.game.setDelay = 3000;
                    room.game.setEnd = function() { //after._setEnd()
                        if (!this.isEnd()) {
                            debug('set end')
                            setTimeout(() => {
                                lobby.to(id).emit('card event', 'notification', 'set' + (this.set + 1) + ' start');
                                debug('start')
                                room.game.start()
                            }, room.game.setDelay)
                            // lobby.to(id).emit('card event', 'set', room.game.players)
                        } else {
                            lobby.to(id).emit('card event', 'notification', 'Game end');
                            setTimeout(() => {
                                leaveGame(id);
                            }, 5000)
                        }
                    }
                    room.game.start()
                    // for (let i in room.members) {
                    //     let id = players[i].id;
                    //     lobby.to(id).emit('card event', 'start', players[i].player.onhand)
                    // }
                    lobby.to(id).emit('client room', 'start game', room.game)
                }
            }
        })
        //----------------------GAME-------------------
        socket.on('action', (c) => {
            if (players[user] === undefined) {
                socket.emit('reject', '請重新整理')
                return
            }
            let player = players[user].player;
            player.action(c);
        })
        //---------------------------------------------
        socket.on('chat', (mes) => {
            if (players[user] === undefined) {
                socket.emit('reject', '請重新整理')
                return
            }
            let room = players[user].atRoom;
            lobby.to(room).emit('chat', {
                name: userName,
                id: user,
                mes: mes
            })
        })
        socket.on('disconnect', () => {
            debug(`${user} disconnected`)
            if (players[user] === undefined)
                return;
            if (players[user].atRoom !== undefined) { //at room
                let roomId = players[user].atRoom;
                if (rooms[roomId].status === 'playing') { //at game
                    lobby.to(roomId).emit('card event', 'notification', user + ' quits this game.')
                    setTimeout(() => { leaveGame(roomId) }, 2000)
                }
                leaveRoom(user, false, true)
            } else if (players[user].atRoom === undefined) { // at lobby
                delete players[user]
            }
        })
    })

    function leaveRoom(user, socket, disconnect) {
        let roomId = players[user].atRoom;
        let theRoom = rooms[roomId];
        delete theRoom.members[user];
        if (Object.keys(theRoom.members).length === 0) { //房間沒人
            delete rooms[roomId]
            lobby.emit('update room', 'delete', theRoom) //update room 是大廳的event /所有人
        } else { //房間有人
            lobby.to(roomId).emit('client room', 'others leave', theRoom)
            lobby.emit('update room', 'leave', theRoom)
        }
        if (socket) //leave room (socket.io), to lobby
            socket.leave(roomId)
        if (disconnect && disableSameDevice) //disconnected
            delete players[user]
        else // leave room , to lobby
            players[user] = { name: players[user].name };
    }

    function leaveGame(roomName) {
        let theRoom = rooms[roomName];
        if (theRoom && theRoom.game) {
            for (let i in theRoom.members) {
                let user = theRoom.members[i]
                user.status = false;
                delete players[user.id].player;
            }
            delete rooms[roomName].game
            theRoom.status = 'waiting';
            lobby.to(roomName).emit('client room', 'leave game', theRoom)
        }
    }
}

module.exports = createIo;