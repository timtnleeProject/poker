const debug = require('debug')('poker:gameController');

let initialize = false;
let all = {
	rooms:0,
	players:0,
	socketIo:0,
	leaveGame:0
}
//init
exports.init = function(arg){
	all.socketIo = arg.socketIo;
	all.leaveGame = arg.leaveGame;
	all.rooms = arg.rooms;
	all.players = arg.players;
	initialize = true;
}
//hearts
const allGames = require('./game');
const Hearts = allGames.Hearts;
function hearts(roomId) {
	if(!initialize)
		throw 'gameController: not initialize.'
	let id = roomId;
	let room = all.rooms[id];
	let players = all.players;
	let lobby = all.socketIo;
	let leaveGame = all.leaveGame;
    room.game = new Hearts.Game({
        maxSets: room.maxSets,
        maxScore: room.maxScore,
        timeLimit: room.time
    })
    for (let i in room.members) {
        //let member = room.members[i];
        let p = new Hearts.Player({ name: room.members[i].name, id: room.members[i].id });
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
    let countDown;
    // let isPlaying = () => room.game.players.find((p) => {
    //     return p.status === 'play'
    // })
    let startTimer = function(player) {
        let count = 10;
        debug('timer: start')
        timer = setTimeout(() => { //提醒
            countDown = setInterval(() => {
                if (count < 0) {
                    clearTimeout(countDown)
                    return
                }
                if (!room.game) {
                    clearTimeout(countDown)
                    return
                }
                if (player.status !== 'play') {
                    debug('timer: wrong, not this player');
                    clearTimeout(countDown)
                    return;
                }
                if (players[player.id] === undefined) {
                    clearTimeout(countDown)
                    return;
                }
                if (count === 0) {
                    let mes = player.name + ' overtime. Throw a card automatically.'
                    lobby.to(id).emit('card event', 'notification', mes)
                    room.game.autoPlay(player);
                } else {
                    let sessionId = players[player.id].id;
                    lobby.to(sessionId).emit('card event', 'countDown', count)
                    count--;
                }
            }, 1000)
        }, room.game.timeLimit - 10100)
    }
    let clearTimer = function() {
        debug('timer: clear')
        //clearTimeout(timer);
        clearTimeout(timer);
        clearTimeout(countDown);
    }
    room.game.init();
    room.game.start = () => {
        room.game.wash()
        room.game.licensing()
        if (room.game.set === 0)
            room.game.players[0].status = 'play';
        lobby.to(id).emit('card event', 'start', room.game)
        startTimer(room.game.players[0]);
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
                    validate = "You still have " + this.roundColor;
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
            startTimer(room.game.findNext(p))
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
                debug('round end')
                if (biggest.player.onhand.length !== 0)
                    biggest.player.status = 'play';
                lobby.to(id).emit('card event', 'round', room.game.players)
                startTimer(biggest.player)
                resolve()
            }, room.game.roundDelay)
        })
    }
    room.game.isEnd = function() {
        if (this.set == this.maxSets)
            return true;
        let player = this.players.find((p) => {
            return p.score >= this.maxScore || p.score <= this.maxScore * -1;
        })
        if (player)
            return true
        else
            return false;
    }
    room.game.setDelay = 2000;
    room.game.setEnd = function() { //after._setEnd()
        if (!this.isEnd()) {
            debug('set end')
            setTimeout(() => {
                lobby.to(id).emit('card event', 'notification', 'set' + (this.set + 1) + ' start');
                debug('start')
                room.game.start() //這裡更新分數
            }, room.game.setDelay)
            // lobby.to(id).emit('card event', 'set', room.game.players)
        } else {
            room.game.players.sort((a, b) => {
                return b.score - a.score
            })
            setTimeout(() => {
                lobby.to(id).emit('card event', 'start', room.game)
                leaveGame(id);
                lobby.to(id).emit('card event', 'game end', room);
            }, room.game.setDelay)
        }
    }
    room.game.invalid = function(e){
    	lobby.to(id).emit('reject',e);
    }
    if(room.game.check){
    	room.game.start()
    	lobby.to(id).emit('client room', 'start game', room.game)
    }
}

exports.hearts = hearts;

//bridge
