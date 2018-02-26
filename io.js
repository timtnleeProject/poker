const socket = require('socket.io');
const io_session = require('express-socket.io-session');
const debug = require('debug')('poker:io');
const getId = require('./modules/random');
const record = require('./modules/record');
const gameController = require('./modules/gameController');
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
    gameController.init({
        rooms: rooms,
        players: players,
        socketIo: lobby,
        leaveGame: leaveGame
    })
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
                socket._err = 'You have been connected on this device. All your connections will be closed.';
                lobby.to(players[user].socketId).emit('denied', socket._err);
                delete players[user];
            }
        } else if (user === undefined) {
            //debug('no session')
            socket._err = 'no session';
            // next(new Error('no session'))
            return;
        } else {
            players[user] = {
                name: name,
                socketId: socket.id
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
                        maxSets: arg.maxSets,
                        type: 'hearts'
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
                    socket.emit('client room', 'join', { room: newRoom, user: user });
                })
            } else if (event === 'join') { //in this case arg is id
                let id = arg;
                let theRoom = rooms[id];
                if (theRoom === undefined)
                    return;
                if(players[user].atRoom){
                    socket.emit('reject', 'You already in a room.');
                    leaveRoom(user, socket, true)
                    return;
                }
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
                lobby.to(id).emit('client room', 'join', { room: theRoom, user: user });
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
                    lobby.emit('update room', 'join', room);

                    let type = room.type;
                    gameController.hearts(id);
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
                    leaveGame(roomId)
                    lobby.to(roomId).emit('client room', 'leave game', rooms[roomId])
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
        }
    }
}

module.exports = createIo;