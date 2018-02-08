function generate(num){
	const char = 'abcdefghijklmnopqrstuvwxyz1234567890ABDEFGHMNQ';
	let rlt = '';
	for(let i=0;i<num;i++){
		let key = Math.floor(Math.random()*char.length);
		rlt += char[key];
	}
	return rlt;
}

function getUniqueId(num,list,addToList){
	return new Promise((res,rej)=>{
		let repeat = ()=>{
			let id = generate(num);
			if(list[id]!==undefined){
				setImmediate(repeat)
			} else{
				if(addToList===true)
						list[id]={};
				res(id)
			}
		}
		repeat()
	})
}

module.exports = getUniqueId;