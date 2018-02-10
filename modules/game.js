const debug = require('debug')('poker:game');
const cardNum = 52;

function Deck() {
    this.cards = [];
    for (let i = 0; i < cardNum; i++) {
        this.cards.push(new Card(i));
    }
}
Deck.prototype.shuffling = function(times) {
    let _times = times
    if (_times === undefined)
        _times = 1
    for (let i = 0; i < _times; i++) {
        let range_top = Math.floor(Math.random() * 15) + 15; //15~30
        let range = 20;
        let range_bot = range_top + range;
        let ori_1 = this.cards.slice(0, range_top);
        let ori_2 = this.cards.slice(range_top, range_bot);
        let ori_3 = this.cards.slice(range_bot);
        this.cards = ori_2.concat(ori_1).concat(ori_3)
    }
}

Deck.prototype.riffle = function(times) {
    let rif = () => {
        for (let i = 0; i < this.cards.length; i++) {
            if (i % 2 === 0) {
                let ori_1 = this.cards[i];
                this.cards[i] = this.cards[i + 1];
                this.cards[i + 1] = ori_1;
            }
        }
    }
    let _times = times
    if (_times === undefined)
        _times = 1
    for (let i = 0; i < _times; i++) {
        rif()
    }
}
Deck.prototype.cut = function(times) {
    let _times = times
    if (_times === undefined)
        _times = 1
    for (let i = 0; i < _times; i++) {
        let point = Math.floor(Math.random() * 10) + 21; //21~31
        let ori_1 = this.cards.slice(0, point);
        let ori_2 = this.cards.slice(point);
        this.cards = ori_2.concat(ori_1)
    }
}
Deck.prototype.distribute = function() {
    let rlt = [];
    for (let i = 0; i < cardNum; i++) {
        let index = i % 4;
        if (!rlt[index])
            rlt[index] = [];
        rlt[index].push(this.cards[i]);
    }
    return rlt;
}

function Card(index) {
    this.index = index;
    let suit = index % 4;
    let suitIndex = suit;
    let role = 'normal'
    switch (suit) {
        case 0:
            suit = 'club'
            break;
        case 1:
            suit = 'diamond'
            break;
        case 2:
            suit = 'heart';
            role = 'score'
            break;
        case 3:
            suit = 'spade';
            break;
    }
    let value = Math.floor(index / 4);
    switch (value) {
        case 12:
            value = 'A';
            break;
        case 11:
            value = 'K';
            break;
        case 10:
            value = 'Q';
            break;
        case 9:
            value = 'J';
            break;
        default:
            value = (value + 2).toString();
            break;
    }
    switch (index) {
        case 43:
            role = 'pig'
            break;
        case 37:
            role = 'sheet'
            break;
        case 32:
            role = 'double'
            break;
    }
    this.role = role;
    this.suitIndex = suitIndex;
    this.suit = suit;
    this.value = value;
    this.place = 0;
}

function Player(arg) {
    this.name = arg.name;
    this.id = arg.id;
    this.onhand = [];
    this.ontable = [];
    this.score = 0;
    this.status = 'wait';
}
Player.prototype.action = function($c) {
    if (this.status !== 'play') {
        this._invalid('Not your turn')
        return
    }
    let card = this.onhand.find((c) => {
        return c.index === $c.index;
    })
    if (card) {
        this.emit('action', card)
        return true
    }
    this._invalid(`No card ${$c.suit+$c.value} onhand`);
    return false;
}
Player.prototype.play = function($c) { //card or index
    let card = this.onhand.find((c, i) => {
        if (c === $c || c.index === $c) {
            this.onhand.splice(i, 1)
            return true;
        }
        return false;
    })
    return card;
}
Player.prototype.emit = function(name, card) {
    if (name === 'action') {
        if (this.binding)
            this.binding(card)
    }
}
Player.prototype.on = function(name, fn) {
    if (name === 'action') {
        this.binding = fn;
    }
}
Player.prototype.sortCards = function(by, dsc) {
    let compare;
    switch (by) {
        case 'index':
            compare = (a, b) => {
                return b.index - a.index;
            }
            break;
        case 'color':
            compare = (a, b) => {
                let order = b.suitIndex - a.suitIndex;
                if (order === 0)
                    return b.index - a.index;
                return order
            }
            break;
    }
    this.onhand.sort(compare);
    if (dsc)
        this.onhand.reverse();
}

Player.prototype._invalid = function(e) {
    debug(e)
    if (this.invalid)
        this.invalid(e)
}

function Game(arg) {
    this.players = arg.players || []; //array
    this.deck;
    this.set = 0;
    this.round = 0;
    this.inRound = 0;
    this.roundColor = '';
    this.roundPlayed = [];
    this.maxSets = arg.maxSets || false;
    this.maxScore = arg.maxScore || false;
    this.timeLimit = arg.timeLimit*1000;
    //-----
    this.start = () => {}
    this.action = () => {}
    this.roundEnd = () => {} //Promise
    this.setEnd = () => {}
    this.actionValid = () => {}
}
Game.prototype.join = function(p) {
    this.players.push(p)
}
Game.prototype.check = function() {
    let message = '';
    if (this.players.length < 4)
        message += 'players number < 4\n';
    let checkName = {};
    this.players.forEach((p) => {
        checkName[p.id] = 1;
    })
    if (Object.keys(checkName).length != this.players.length)
        message += "players' name repeat."
    if (message === '') {
        return true
    } else {
        this._invalid(message)
        return false
    }
}
Game.prototype.init = function() {
    this.deck = new Deck();
    this.players.forEach((p, index) => {
        p.index = index;
        p.on('action', (card) => {
            debug('action')
            let validate = this.actionValid(p, card)
            if (validate === true) {
                this._action(p, card)
                this.action(p, card);
                if (this.inRound === 4) {
                    this.roundEnd().then(() => {
                        if (p.onhand.length === 0) {
                            this._setEnd();
                            this.setEnd();
                        } 
                    })
                    this._roundEnd()
                }
            } else {
                debug(validate)
                if (this.actionReject)
                    this.actionReject(p, validate)
            }
        })
    })
}
Game.prototype.wash = function() {
    debug('wash deck')
    let d = this.deck;    
    d.shuffling(5)
    d.riffle()
    d.cut()
    d.shuffling(5)
    d.riffle()
    d.cut()
    d.shuffling(5)
    d.riffle()
    d.cut()
    d.shuffling(5)
    d.riffle()
    d.cut()
}
Game.prototype.licensing = function() {
    debug('licensing')
    let d = this.deck.distribute();
    d.forEach((d, i) => {
        this.players[i].onhand = d;
        this.players[i].sortCards('color')
    })
}
Game.prototype.findNext = function(p) {
    return this.players[(p.index + 1) % 4];
}
Game.prototype.autoPlay = function(p){
    let sameColor=p.onhand.find((c)=>{
        return c.suit===this.roundColor;
    })
    let hasOther= p.onhand.find((c)=>{
        return c.suit!=='heart';
    })
    let card;
    if(sameColor){
        console.log('sameColor')
        console.log(this.roundColor)
       card=sameColor;
    } else if(this.isVoid){
        card=p.onhand[0];
    } else if(!hasOther){
        card=p.onhand[0];
    } else{

        card=p.onhand.find((c)=>{
            return c.suit!=='heart';
        })
        console.log(card)
    }
    p.action(card)
}
Game.prototype._action = function(p, card) {
    p.play(card)
    p.status = 'wait'
    this.roundPlayed.push({
        player: p,
        card: card
    })
    if (this.inRound === 0)
        this.roundColor = card.suit;
    this.inRound++;
    if (this.inRound !== 4)
        this.findNext(p).status = 'play';
}
Game.prototype._roundEnd = function() {
    this.round++;
    this.inRound = 0;
    this.roundPlayed = [];
}
Game.prototype._setEnd = function() {
    this.players.forEach((player) => { //計分
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
    this.isVoid = false;
    this.round = 0;
    this.set++;
    this.players.forEach((p, i) => { // in ._setEnd()?? fail
        p.ontable = [];
    })
}
Game.prototype._invalid = function(e) {
    debug(e)
    if (this.invalid)
        this.invalid()
}
// let d = new Deck()
// let p = new Player('tim', 0)
// debug(d)
// p.onhand = d.distribute()[0];
// p.sortCards('color');

// let players = []
// for (let i = 0; i < 4; i++) {
//     players.push(new Player('P' + i));
// }
// let g = new Game({
//     players: players,
//     sets: 2
// })

// console.log(new Deck())
// g.action = function(p, card) {
//     // let span = document.getElementById('card' + card.index);
//     // document.querySelector('#player' + p.index).removeChild(span);
// }
// g.start = () => {
//     g.wash()
//     g.licensing()
//     // let divs = document.querySelectorAll('#area>div');
//     // divs.forEach((div, i) => {
//     //     players[i].onhand.forEach((c) => {
//     //         let span = document.createElement('SPAN')
//     //         span.style.color = 'blue';
//     //         span.textContent = c.suit + c.value + '/'
//     //         span.id = 'card' + c.index
//     //         span.addEventListener('click', () => {
//     //             players[i].action(c)
//     //         })
//     //         div.appendChild(span)
//     //     })
//     // })
// }
// g.setEnd = function() {
//     setTimeout(g.start, 1000)
// }
// if (g.check()) {
//     g.init()
//     g.start()
//     players[0].status = 'play'
// }
exports.Game = Game;
exports.Player = Player;
exports.Card = Card;