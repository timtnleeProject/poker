const Game = require('./game').Game;
const Player = require('./game').Player;
const Card = require('./game').Card;
let players = []
for (let i = 0; i < 4; i++) {
    players.push(new Player('player' + i))
}

let g = new Game({
    players: players,
    maxSet: 10
})

g.players[0].ontable=[new Card(46),new Card(37)]
test()
function test() {
    g.players.forEach((player) => { //計分
        console.log('for each')
        let score = 0;
        let score_length = 0;
        let mult = 1;
        let pig = 0;
        let sheet = 0;
        player.ontable.forEach((card) => {
            console.log(card)
            if (card.role === 'score') {
                console.log('score')
                score_length++;
                switch (card.value) {
                    case 'A':
                        score -= 50
                        break;
                    case 'K':
                        console.log('&&&&&&&&&&&&')
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
            // console.log(score)
            // console.log(pig)
            // console.log(sheet)
            // console.log(mult)
        }
        player.score += score;
    })
}
players.forEach((p)=>{
    console.log(p.score)
})
