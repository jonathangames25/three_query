#!/bin/bash

API="http://localhost:3000/api/query"

# Function to send a query
send_query() {
    curl -s -X POST "$API" -H "Content-Type: application/json" -d "{\"query\": \"$1\"}" > /dev/null
}

echo "Building a stunning GridRunner Game..."

# 1. Environment, Skybox, and Neon Lighting
send_query "spawn type=skybox color=#08020f"
send_query "spawn type=light ltype=ambient color=#00d2ff intensity=0.4"
send_query "spawn type=light ltype=directional color=#ff007f intensity=1.5 position=0,15,10"
send_query "spawn type=light ltype=point color=#00ff87 intensity=2 position=0,2,-15"

# Wait a bit for initialization
sleep 1

# 2. Build the Cyberpunk Track & Side Barriers
# Left neon barrier
send_query "spawn type=mesh shape=box name=barrier_l color=#ff007f position=-7,0.5,0 scale=0.3,1,100"
# Right neon barrier
send_query "spawn type=mesh shape=box name=barrier_r color=#ff007f position=7,0.5,0 scale=0.3,1,100"

# Neon arches/columns along the runway for depth
send_query "spawn type=mesh shape=box name=arch1 color=#00f2fe position=0,6,-20 scale=14,0.4,1"
send_query "spawn type=mesh shape=box name=col1l color=#00f2fe position=-7,3,-20 scale=0.4,6,0.4"
send_query "spawn type=mesh shape=box name=col1r color=#00f2fe position=7,3,-20 scale=0.4,6,0.4"

send_query "spawn type=mesh shape=box name=arch2 color=#00f2fe position=0,6,-50 scale=14,0.4,1"
send_query "spawn type=mesh shape=box name=col2l color=#00f2fe position=-7,3,-50 scale=0.4,6,0.4"
send_query "spawn type=mesh shape=box name=col2r color=#00f2fe position=7,3,-50 scale=0.4,6,0.4"

send_query "spawn type=mesh shape=box name=arch3 color=#00f2fe position=0,6,-80 scale=14,0.4,1"
send_query "spawn type=mesh shape=box name=col3l color=#00f2fe position=-7,3,-80 scale=0.4,6,0.4"
send_query "spawn type=mesh shape=box name=col3r color=#00f2fe position=7,3,-80 scale=0.4,6,0.4"

# 3. Spawn Player Hovercraft Ship (Fuselage + Wings + Thruster)
send_query "spawn type=mesh shape=box name=player color=#00f2fe position=0,0.5,8 scale=1,0.3,1.6"
send_query "spawn type=mesh shape=box name=wing_l color=#00abff position=-0.8,0,0 scale=0.6,0.15,0.8"
send_query "link child=wing_l parent=player"
send_query "spawn type=mesh shape=box name=wing_r color=#00abff position=0.8,0,0 scale=0.6,0.15,0.8"
send_query "link child=wing_r parent=player"
send_query "spawn type=mesh shape=box name=thruster color=#ff007f position=0,0,0.9 scale=0.3,0.2,0.3"
send_query "link child=thruster parent=player"

# 4. Spawn Neon Obstacles (Red columns)
send_query "spawn type=mesh shape=box name=obs1 color=#ef4444 position=0,1,-30 scale=1.4,2,1.4"
send_query "modify name=obs1 moveSpeed=14 moveDirection=0,0,1 rotateSpeed=90 rotateDirection=1,1,0"

send_query "spawn type=mesh shape=box name=obs2 color=#ef4444 position=-4,1,-45 scale=1.4,2,1.4"
send_query "modify name=obs2 moveSpeed=16 moveDirection=0,0,1 rotateSpeed=60 rotateDirection=0,1,1"

send_query "spawn type=mesh shape=box name=obs3 color=#ef4444 position=4,1,-60 scale=1.4,2,1.4"
send_query "modify name=obs3 moveSpeed=18 moveDirection=0,0,1 rotateSpeed=100 rotateDirection=1,0,1"

# 5. Spawn Collectibles (Gold Energy Orbs)
send_query "spawn type=mesh shape=sphere name=coin1 color=#eab308 position=-3,0.6,-25 scale=0.6,0.6,0.6"
send_query "modify name=coin1 moveSpeed=12 moveDirection=0,0,1 rotateSpeed=180 rotateDirection=0,1,0"

send_query "spawn type=mesh shape=sphere name=coin2 color=#eab308 position=3,0.6,-40 scale=0.6,0.6,0.6"
send_query "modify name=coin2 moveSpeed=12 moveDirection=0,0,1 rotateSpeed=180 rotateDirection=0,1,0"

# 6. Inject game logic script to manage controls, scoring, collision detection, and custom Chase Camera
send_query "spawn type=script name=game_manager target=player onupdate='if(!window.gameScore){window.gameScore=0;window.gameObstacles=[\`obs1\`,\`obs2\`,\`obs3\`];window.gameCoins=[\`coin1\`,\`coin2\`];engine.logMessage(\`GridRunner\`,\`Avoid red obstacles! Collect gold orbs!\`,\`info\`);engine.logMessage(\`Controls\`,\`Use Left/Right arrow keys or A/D to steer.\`,\`info\`);}const player=engine.objects.get(\`player\`);if(player&&player.mesh){const pMesh=player.mesh;const speed=12;if(engine.activeKeys[\`left_arrow\`]||engine.activeKeys[\`arrowleft\`]||engine.activeKeys[\`a\`]){pMesh.position.x-=speed*dt;}if(engine.activeKeys[\`right_arrow\`]||engine.activeKeys[\`arrowright\`]||engine.activeKeys[\`d\`]){pMesh.position.x+=speed*dt;}pMesh.position.x=Math.max(-6,Math.min(6,pMesh.position.x));if(engine.activeKeys[\`left_arrow\`]||engine.activeKeys[\`arrowleft\`]||engine.activeKeys[\`a\`]){pMesh.rotation.z=Math.min(0.3,pMesh.rotation.z+2*dt);}else if(engine.activeKeys[\`right_arrow\`]||engine.activeKeys[\`arrowright\`]||engine.activeKeys[\`d\`]){pMesh.rotation.z=Math.max(-0.3,pMesh.rotation.z-2*dt);}else{pMesh.rotation.z*=0.9;}if(engine.controls){engine.controls.enabled=false;}engine.camera.position.set(pMesh.position.x,4,pMesh.position.z+7);engine.camera.lookAt(pMesh.position.x,1,pMesh.position.z-10);}const playerPos=player&&player.mesh?player.mesh.position:null;if(playerPos){window.gameObstacles.forEach(obsName=>{const obs=engine.objects.get(obsName);if(obs&&obs.mesh){const oMesh=obs.mesh;if(oMesh.position.z>15){oMesh.position.z=-35-Math.random()*20;oMesh.position.x=(Math.random()-0.5)*12;}const dist=playerPos.distanceTo(oMesh.position);if(dist<1.6){window.gameScore=0;engine.logMessage(\`Collision\`,\`Ship crashed! Score reset.\`,\`error\`);oMesh.position.z=-35-Math.random()*20;oMesh.position.x=(Math.random()-0.5)*12;}}});window.gameCoins.forEach(coinName=>{const coin=engine.objects.get(coinName);if(coin&&coin.mesh){const cMesh=coin.mesh;if(cMesh.position.z>15){cMesh.position.z=-35-Math.random()*15;cMesh.position.x=(Math.random()-0.5)*12;}const dist=playerPos.distanceTo(cMesh.position);if(dist<1.4){window.gameScore+=100;engine.logMessage(\`Score\`,\`Score: \`+window.gameScore,\`success\`);cMesh.position.z=-35-Math.random()*15;cMesh.position.x=(Math.random()-0.5)*12;}}});}'"

echo "GridRunner built. Let the game begin!"
