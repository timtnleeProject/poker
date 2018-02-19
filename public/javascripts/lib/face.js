function drawFace(arg){
	var el = arg.el;
	el.width=1000;
	el.height =1000;
	var ctx = el.getContext("2d");
	// //臉
	ctx.fillStyle = "#ffbb77";
	ctx.beginPath()
	ctx.arc(500, 500, 350, 0, Math.PI*2)
	ctx.fill()
	ctx.closePath()
	
	//眼睛
	ctx.beginPath()
	ctx.fillStyle = "black";
	ctx.arc(700, 550, 50, 0, Math.PI*2)
	ctx.arc(300, 550, 50, 0, Math.PI*2)
	ctx.fill()
	ctx.closePath()
	
	//眼睛反光
	ctx.beginPath()
	ctx.fillStyle = "white";
	ctx.arc(730, 520, 10, 0, Math.PI*2)
	ctx.arc(330, 520, 10, 0, Math.PI*2)
	ctx.fill()
	ctx.closePath()
	//嘴
	ctx.beginPath()
  	ctx.strokeStyle='black';
    ctx.moveTo(300,700);
    ctx.lineTo(700,700)
    ctx.lineWidth = "10";
    ctx.stroke();
    ctx.closePath()
    //眉
    ctx.beginPath()
  	ctx.strokeStyle='black';
  	ctx.moveTo(750,400)
    ctx.lineTo(650,420)
    ctx.moveTo(250,400)
	ctx.lineTo(350,420)
    ctx.lineWidth = "5";
    ctx.stroke();
    ctx.closePath()
    //髮 (前)
    ctx.beginPath();
    ctx.globalCompositeOperation="source-atop";
    ctx.moveTo(150,150)
    ctx.lineTo(850,150)
    ctx.lineTo(850,400)
    ctx.lineTo(300,300)
    ctx.lineTo(150,400)
    ctx.fillStyle='black'
    ctx.fill()
}