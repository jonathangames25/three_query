import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// We import Rapier dynamically since it requires async initialization
// Using unpkg or skypack. Skypack provides ES module compatibility easily.
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

class Engine {
    constructor() {
        this.objects = new Map();
        this.scripts = [];
        this.character = null;
        this.consoleMuted = false;
        this.init();
    }

    async init() {
        try {
            await RAPIER.init();
            this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
            this.logMessage('System', 'Physics initialized (Rapier)', 'info');
        } catch (e) {
            this.logMessage('Error', 'Failed to load physics engine', 'error');
            console.error(e);
        }

        const container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        
        // Premium default dark skybox
        this.scene.background = new THREE.Color('#0f172a');
        this.scene.fog = new THREE.FogExp2('#0f172a', 0.02);
        
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 15);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground

        // Default Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // Add a nice default ground plane
        const groundGeo = new THREE.PlaneGeometry(100, 100);
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: '#1e293b',
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add a grid helper for OrbitControls reference
        const gridHelper = new THREE.GridHelper(100, 50, 0x4f46e5, 0x334155);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // Ground Physics
        if (this.world) {
            let bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
            let body = this.world.createRigidBody(bodyDesc);
            let colliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.1, 50);
            this.world.createCollider(colliderDesc, body);
        }

        // Global key tracking for animations
        this.activeKeys = {};
        window.addEventListener('keydown', e => {
            const key = e.key.toLowerCase();
            this.activeKeys[key] = true;
            if (e.key === 'ArrowUp') this.activeKeys['up_arrow'] = true;
            if (e.key === 'ArrowDown') this.activeKeys['down_arrow'] = true;
            if (e.key === 'ArrowLeft') this.activeKeys['left_arrow'] = true;
            if (e.key === 'ArrowRight') this.activeKeys['right_arrow'] = true;
            if (e.key === ' ') this.activeKeys['space'] = true;
        });
        window.addEventListener('keyup', e => {
            const key = e.key.toLowerCase();
            this.activeKeys[key] = false;
            if (e.key === 'ArrowUp') this.activeKeys['up_arrow'] = false;
            if (e.key === 'ArrowDown') this.activeKeys['down_arrow'] = false;
            if (e.key === 'ArrowLeft') this.activeKeys['left_arrow'] = false;
            if (e.key === 'ArrowRight') this.activeKeys['right_arrow'] = false;
            if (e.key === ' ') this.activeKeys['space'] = false;
        });

        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        this.clock = new THREE.Clock();
        this.animate();
        this.setupUI();
        
        // Start polling for external commands
        setInterval(async () => {
            try {
                const res = await fetch('/api/poll');
                const data = await res.json();
                if (data.success && data.commands.length > 0) {
                    data.commands.forEach(cmd => {
                        try {
                            this.processCommand(cmd);
                        } catch (e) {
                            this.logMessage('External Command Error', e.message, 'error');
                        }
                    });
                }
            } catch(e){}
        }, 200);

        this.logMessage('System', 'Engine ready. Type "help" or click Cheatsheet.', 'success');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const dt = this.clock.getDelta();

        // Update animated objects
        this.objects.forEach(obj => {
            if (obj.animate && obj.mesh) {
                const mesh = obj.mesh;
                
                // Movement animation
                if (obj.animate.moveSpeed) {
                    let active = true;
                    if (obj.animate.moveInput) {
                        const key = obj.animate.moveInput.toLowerCase();
                        active = !!this.activeKeys[key];
                    }
                    if (active) {
                        const dir = obj.animate.moveDir ? obj.animate.moveDir.clone() : new THREE.Vector3(0, 1, 0);
                        dir.normalize();
                        mesh.position.addScaledVector(dir, obj.animate.moveSpeed * dt);
                        if (obj.rigidBody) {
                            const p = mesh.position;
                            obj.rigidBody.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
                        }
                    }
                }

                // Rotation animation
                if (obj.animate.rotateSpeed) {
                    let active = true;
                    if (obj.animate.rotateInput) {
                        const key = obj.animate.rotateInput.toLowerCase();
                        active = !!this.activeKeys[key];
                    }
                    if (active) {
                        const axis = obj.animate.rotateDir ? obj.animate.rotateDir.clone() : new THREE.Vector3(0, 1, 0);
                        axis.normalize();
                        const speedRad = THREE.MathUtils.degToRad(obj.animate.rotateSpeed);
                        mesh.rotateOnAxis(axis, speedRad * dt);
                        if (obj.rigidBody) {
                            const q = new THREE.Quaternion().setFromEuler(mesh.rotation);
                            obj.rigidBody.setRotation(q, true);
                        }
                    }
                }
            }
        });

        if (this.world) {
            this.world.step();
            // Sync physics to graphics
            this.objects.forEach(obj => {
                if (obj.rigidBody && obj.mesh) {
                    const pos = obj.rigidBody.translation();
                    const rot = obj.rigidBody.rotation();
                    obj.mesh.position.set(pos.x, pos.y, pos.z);
                    obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
                }
            });
        }

        // Run scripts
        this.scripts.forEach(script => {
            if (script.onupdate) {
                try {
                    const fn = new Function('engine', 'dt', script.onupdate);
                    fn(this, dt);
                } catch(e) {}
            }
        });

        // Character update
        if (this.character && this.world) {
            this.updateCharacter(dt);
        } else {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    async executeQuery(queryText) {
        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryText, fromFrontend: true })
            });
            const data = await response.json();

            if (!data.success) {
                this.logMessage('Error', data.error, 'error');
                return;
            }

            this.processCommand(data.command);
            this.logMessage('Success', `Executed: ${queryText}`, 'success');
        } catch (e) {
            this.logMessage('Error', e.message, 'error');
        }
    }

    processCommand(cmd) {
        const { action, args } = cmd;

        switch(action) {
            case 'SPAWN': this.spawnObject(args); break;
            case 'MODIFY': this.modifyObject(args.name, args); break;
            case 'DELETE': this.deleteObject(args.name); break;
            case 'LINK': this.linkObjects(args.child, args.parent); break;
            case 'GET': this.getObjectInfo(args.name); break;
            default: throw new Error(`Unknown action: ${action}`);
        }
    }

    parseDirection(dirStr) {
        if (!dirStr) return new THREE.Vector3(0, 1, 0);
        dirStr = dirStr.toLowerCase().trim();
        if (dirStr === 'x') return new THREE.Vector3(1, 0, 0);
        if (dirStr === 'y') return new THREE.Vector3(0, 1, 0);
        if (dirStr === 'z') return new THREE.Vector3(0, 0, 1);
        if (dirStr === 'up') return new THREE.Vector3(0, 1, 0);
        if (dirStr === 'down') return new THREE.Vector3(0, -1, 0);
        if (dirStr === 'left') return new THREE.Vector3(-1, 0, 0);
        if (dirStr === 'right') return new THREE.Vector3(1, 0, 0);
        if (dirStr === 'forward') return new THREE.Vector3(0, 0, -1);
        if (dirStr === 'back') return new THREE.Vector3(0, 0, 1);
        
        const parts = dirStr.split(',').map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
            return new THREE.Vector3(parts[0], parts[1], parts[2]);
        }
        return new THREE.Vector3(0, 1, 0);
    }

    updateObjectAnimation(obj, args) {
        if (!obj.animate) {
            obj.animate = {};
        }

        // Support generic animation arguments: speed, direction, input, mode
        const mode = args.mode || 'rotate'; // default mode is rotate

        if (args.speed !== undefined) {
            const speedVal = parseFloat(args.speed);
            if (mode === 'move') {
                obj.animate.moveSpeed = speedVal;
            } else {
                obj.animate.rotateSpeed = speedVal;
            }
        }
        if (args.direction !== undefined) {
            const dirVec = this.parseDirection(args.direction);
            if (mode === 'move') {
                obj.animate.moveDir = dirVec;
            } else {
                obj.animate.rotateDir = dirVec;
            }
        }
        if (args.input !== undefined) {
            const inputVal = args.input;
            if (mode === 'move') {
                obj.animate.moveInput = inputVal;
            } else {
                obj.animate.rotateInput = inputVal;
            }
        }

        // Support explicit animation arguments: moveSpeed, moveDir/moveDirection, moveInput/moveKey
        if (args.moveSpeed !== undefined) {
            obj.animate.moveSpeed = parseFloat(args.moveSpeed);
        }
        if (args.moveDir !== undefined) {
            obj.animate.moveDir = this.parseDirection(args.moveDir);
        }
        if (args.moveDirection !== undefined) {
            obj.animate.moveDir = this.parseDirection(args.moveDirection);
        }
        if (args.moveInput !== undefined) {
            obj.animate.moveInput = args.moveInput;
        }
        if (args.moveKey !== undefined) {
            obj.animate.moveInput = args.moveKey;
        }

        // Support explicit animation arguments: rotateSpeed, rotateDir/rotateDirection, rotateInput/rotateKey
        if (args.rotateSpeed !== undefined) {
            obj.animate.rotateSpeed = parseFloat(args.rotateSpeed);
        }
        if (args.rotateDir !== undefined) {
            obj.animate.rotateDir = this.parseDirection(args.rotateDir);
        }
        if (args.rotateDirection !== undefined) {
            obj.animate.rotateDir = this.parseDirection(args.rotateDirection);
        }
        if (args.rotateInput !== undefined) {
            obj.animate.rotateInput = args.rotateInput;
        }
        if (args.rotateKey !== undefined) {
            obj.animate.rotateInput = args.rotateKey;
        }
    }

    spawnObject(args) {
        const type = args.type || 'mesh';
        const name = args.name || `obj_${Date.now()}`;
        
        if (this.objects.has(name) && type !== 'script' && type !== 'collision') {
            throw new Error(`Object with name ${name} already exists.`);
        }

        const objData = { name, type, children: [], parent: null };
        let threeObj = null;

        if (type === 'mesh') {
            threeObj = this.spawnMesh(args);
        } else if (type === 'light') {
            threeObj = this.spawnLight(args);
        } else if (type === 'transform') {
            threeObj = new THREE.Group();
        } else if (type === 'skybox') {
            const color = args.color || '#000000';
            if (this.scene.background) {
                this.scene.background.set(color);
            } else {
                this.scene.background = new THREE.Color(color);
            }
            if (this.scene.fog) {
                this.scene.fog.color.set(color);
            } else {
                this.scene.fog = new THREE.FogExp2(color, 0.02);
            }
            this.objects.set(name, objData);
            return; 
        } else if (type === 'collision') {
            this.spawnCollision(args);
            return;
        } else if (type === 'script') {
            this.scripts.push({
                name,
                target: args.target,
                onstart: args.onstart,
                onupdate: args.onupdate
            });
            if (args.onstart) {
                try {
                    const fn = new Function('engine', args.onstart);
                    fn(this);
                } catch(e) {
                    this.logMessage('Script Error', e.message, 'error');
                }
            }
            return;
        } else if (type === 'character') {
            this.spawnCharacter(args);
            return;
        }

        if (threeObj) {
            threeObj.name = name;
            objData.mesh = threeObj;
            this.scene.add(threeObj);
            
            if (args.position) {
                const [x,y,z] = args.position.split(',').map(Number);
                threeObj.position.set(x,y,z);
            }
            if (args.scale) {
                const [x,y,z] = args.scale.split(',').map(Number);
                threeObj.scale.set(x,y,z);
            }
            
            this.updateObjectAnimation(objData, args);
            
            this.objects.set(name, objData);
        }
    }

    spawnMesh(args) {
        const shape = args.shape || 'box';
        const color = args.color || '#a855f7';
        let geometry;

        if (shape === 'box') {
            geometry = new THREE.BoxGeometry(1, 1, 1);
        } else if (shape === 'sphere') {
            geometry = new THREE.SphereGeometry(0.5, 32, 32);
        } else if (shape === 'plane') {
            geometry = new THREE.PlaneGeometry(1, 1);
        } else {
            geometry = new THREE.BoxGeometry(1, 1, 1);
        }

        const material = new THREE.MeshStandardMaterial({ 
            color,
            roughness: 0.3,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    spawnLight(args) {
        const ltype = args.ltype || 'point';
        const color = args.color || '#ffffff';
        const intensity = parseFloat(args.intensity) || 1;

        let light;
        if (ltype === 'directional') {
            light = new THREE.DirectionalLight(color, intensity);
            light.castShadow = true;
        } else if (ltype === 'ambient') {
            light = new THREE.AmbientLight(color, intensity);
        } else {
            light = new THREE.PointLight(color, intensity, 100);
            light.castShadow = true;
        }
        
        // Add a small helper mesh for visualization
        if (ltype !== 'ambient') {
            const helperGeo = new THREE.SphereGeometry(0.2, 8, 8);
            const helperMat = new THREE.MeshBasicMaterial({ color });
            const helper = new THREE.Mesh(helperGeo, helperMat);
            light.add(helper);
        }
        return light;
    }

    spawnCollision(args) {
        if (!this.world) throw new Error("Physics not initialized.");
        const targetName = args.target;
        if (!targetName || !this.objects.has(targetName)) throw new Error("Collision target missing or not found.");
        const obj = this.objects.get(targetName);
        
        let bodyDesc = RAPIER.RigidBodyDesc.dynamic();
        if (args.static === 'true') bodyDesc = RAPIER.RigidBodyDesc.fixed();
        
        const pos = obj.mesh.position;
        bodyDesc.setTranslation(pos.x, pos.y, pos.z);
        
        const rigidBody = this.world.createRigidBody(bodyDesc);
        
        let colliderDesc;
        const size = args.shape === 'sphere' ? 0.5 : 0.5; // defaults
        if (args.shape === 'sphere') {
            colliderDesc = RAPIER.ColliderDesc.ball(size);
        } else {
            colliderDesc = RAPIER.ColliderDesc.cuboid(size, size, size);
        }
        
        colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        this.world.createCollider(colliderDesc, rigidBody);
        obj.rigidBody = rigidBody;
    }

    spawnCharacter(args) {
        if (!this.world) throw new Error("Physics not initialized.");
        const name = args.name || 'player';
        const pos = args.position ? args.position.split(',').map(Number) : [0, 2, 0];
        
        let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1], pos[2]);
        let rigidBody = this.world.createRigidBody(bodyDesc);
        let colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.3);
        this.world.createCollider(colliderDesc, rigidBody);

        this.character = {
            name,
            rigidBody,
            speed: 5
        };

        this.camera.position.set(0, 1, 0); // local to character later
        this.controls.enabled = false;
        this.setupCharacterInput();
        this.logMessage('System', 'Character spawned. Click on scene to lock pointer and use WASD to move.', 'info');
    }

    setupCharacterInput() {
        this.keys = { w:false, a:false, s:false, d:false };
        document.addEventListener('keydown', e => {
            const k = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(k)) this.keys[k] = true;
        });
        document.addEventListener('keyup', e => {
            const k = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(k)) this.keys[k] = false;
        });

        document.body.requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock;
        document.getElementById('canvas-container').addEventListener('click', () => {
            if (this.character) document.body.requestPointerLock();
        });

        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        document.addEventListener('mousemove', e => {
            if (document.pointerLockElement === document.body && this.character) {
                this.euler.y -= e.movementX * 0.002;
                this.euler.x -= e.movementY * 0.002;
                this.euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
            }
        });
    }

    updateCharacter(dt) {
        if (!this.character || !this.world) return;
        
        const direction = new THREE.Vector3();
        if (this.keys.w) direction.z -= 1;
        if (this.keys.s) direction.z += 1;
        if (this.keys.a) direction.x -= 1;
        if (this.keys.d) direction.x += 1;

        direction.normalize();
        direction.applyEuler(new THREE.Euler(0, this.euler.y, 0));
        
        const currentPos = this.character.rigidBody.translation();
        
        const newPos = {
            x: currentPos.x + direction.x * this.character.speed * dt,
            y: currentPos.y, 
            z: currentPos.z + direction.z * this.character.speed * dt
        };
        
        this.character.rigidBody.setNextKinematicTranslation(newPos);
        this.camera.position.set(newPos.x, newPos.y + 1, newPos.z);
    }

    modifyObject(name, args) {
        if (name === 'skybox') {
            if (args.color) {
                const color = args.color;
                if (this.scene.background) {
                    this.scene.background.set(color);
                } else {
                    this.scene.background = new THREE.Color(color);
                }
                if (this.scene.fog) {
                    this.scene.fog.color.set(color);
                } else {
                    this.scene.fog = new THREE.FogExp2(color, 0.02);
                }
            }
            return;
        }

        const obj = this.objects.get(name);
        if (!obj) throw new Error(`Object ${name} not found`);

        if (obj.type === 'skybox') {
            if (args.color) {
                const color = args.color;
                if (this.scene.background) {
                    this.scene.background.set(color);
                } else {
                    this.scene.background = new THREE.Color(color);
                }
                if (this.scene.fog) {
                    this.scene.fog.color.set(color);
                } else {
                    this.scene.fog = new THREE.FogExp2(color, 0.02);
                }
            }
            return;
        }

        const mesh = obj.mesh;
        if (mesh) {
            if (args.position) {
                const [x,y,z] = args.position.split(',').map(Number);
                mesh.position.set(x,y,z);
                if (obj.rigidBody) {
                    obj.rigidBody.setTranslation({x,y,z}, true);
                }
            }
            if (args.rotation) {
                const [x,y,z] = args.rotation.split(',').map(Number);
                mesh.rotation.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z));
                if (obj.rigidBody) {
                    const quat = new THREE.Quaternion().setFromEuler(mesh.rotation);
                    obj.rigidBody.setRotation(quat, true);
                }
            }
            if (args.scale) {
                const [x,y,z] = args.scale.split(',').map(Number);
                mesh.scale.set(x,y,z);
            }
            if (args.color && mesh.material) {
                mesh.material.color.set(args.color);
            }
            if (args.intensity && mesh.isLight) {
                mesh.intensity = parseFloat(args.intensity);
            }
        }

        this.updateObjectAnimation(obj, args);
    }

    deleteObject(name) {
        const obj = this.objects.get(name);
        if (!obj) throw new Error(`Object ${name} not found`);
        
        if (obj.parent) {
            const parent = this.objects.get(obj.parent);
            if (parent) parent.children = parent.children.filter(c => c !== name);
        }

        if (obj.mesh) {
            obj.mesh.parent.remove(obj.mesh);
        }
        
        if (obj.rigidBody && this.world) {
            this.world.removeRigidBody(obj.rigidBody);
        }
        this.objects.delete(name);
    }

    linkObjects(childName, parentName) {
        const child = this.objects.get(childName);
        const parent = this.objects.get(parentName);
        if (!child || !parent) throw new Error("Child or Parent not found");

        parent.mesh.add(child.mesh);
        child.parent = parentName;
        parent.children.push(childName);
    }

    getObjectInfo(name) {
        if (!name || name === 'all') {
            let names = Array.from(this.objects.keys()).join(', ');
            this.logMessage('Info', `Objects in scene: ${names || 'None'}`, 'info');
        } else {
            const obj = this.objects.get(name);
            if (!obj) throw new Error(`Object ${name} not found`);
            const p = obj.mesh.position;
            this.logMessage('Info', `[${name}] Type: ${obj.type}, Pos: (${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`, 'info');
        }
    }

    setupUI() {
        const input = document.getElementById('query-input');
        const btn = document.getElementById('btn-submit');
        const btnHelp = document.getElementById('btn-help');
        const helpModal = document.getElementById('help-modal');
        const btnCloseHelp = document.getElementById('btn-close-help');

        const submitQuery = () => {
            const q = input.value.trim();
            if (q) {
                this.executeQuery(q);
                input.value = '';
            }
        };

        btn.addEventListener('click', submitQuery);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitQuery();
        });

        btnHelp.addEventListener('click', () => {
            helpModal.classList.remove('hidden');
        });
        btnCloseHelp.addEventListener('click', () => {
            helpModal.classList.add('hidden');
        });

        // Toggle console output
        const btnToggleConsole = document.getElementById('btn-toggle-console');
        const outputPanel = document.getElementById('output-panel');
        if (btnToggleConsole && outputPanel) {
            btnToggleConsole.addEventListener('click', () => {
                this.consoleMuted = !this.consoleMuted;
                if (this.consoleMuted) {
                    btnToggleConsole.innerText = 'Unmute';
                    outputPanel.classList.add('muted');
                } else {
                    btnToggleConsole.innerText = 'Mute';
                    outputPanel.classList.remove('muted');
                }
            });
        }

        // Scripts Modal UI elements
        const btnScripts = document.getElementById('btn-scripts');
        const scriptsModal = document.getElementById('scripts-modal');
        const btnCloseScripts = document.getElementById('btn-close-scripts');
        const scriptSelect = document.getElementById('script-select');
        const editorContainer = document.getElementById('script-editor-container');
        const noScriptsMsg = document.getElementById('no-scripts-msg');
        const scriptTarget = document.getElementById('script-target');
        const scriptOnStart = document.getElementById('script-onstart');
        const scriptOnUpdate = document.getElementById('script-onupdate');
        const btnSaveScript = document.getElementById('btn-save-script');

        const populateScriptsList = () => {
            scriptSelect.innerHTML = '';
            if (this.scripts && this.scripts.length > 0) {
                editorContainer.classList.remove('hidden');
                btnSaveScript.classList.remove('hidden');
                noScriptsMsg.classList.add('hidden');

                this.scripts.forEach(script => {
                    const opt = document.createElement('option');
                    opt.value = script.name;
                    opt.textContent = `${script.name} (target: ${script.target})`;
                    scriptSelect.appendChild(opt);
                });

                // Load first script
                loadScriptData(this.scripts[0]);
            } else {
                editorContainer.classList.add('hidden');
                btnSaveScript.classList.add('hidden');
                noScriptsMsg.classList.remove('hidden');
            }
        };

        const loadScriptData = (script) => {
            if (!script) return;
            scriptTarget.value = script.target || '';
            scriptOnStart.value = script.onstart || '';
            scriptOnUpdate.value = script.onupdate || '';
        };

        if (btnScripts) {
            btnScripts.addEventListener('click', () => {
                populateScriptsList();
                scriptsModal.classList.remove('hidden');
            });
        }

        if (btnCloseScripts) {
            btnCloseScripts.addEventListener('click', () => {
                scriptsModal.classList.add('hidden');
            });
        }

        if (scriptSelect) {
            scriptSelect.addEventListener('change', () => {
                const name = scriptSelect.value;
                const script = this.scripts.find(s => s.name === name);
                loadScriptData(script);
            });
        }

        if (btnSaveScript) {
            btnSaveScript.addEventListener('click', () => {
                const name = scriptSelect.value;
                const script = this.scripts.find(s => s.name === name);
                if (script) {
                    script.target = scriptTarget.value;
                    script.onstart = scriptOnStart.value;
                    script.onupdate = scriptOnUpdate.value;

                    // Stop & restart the script (re-run onstart code if present)
                    if (script.onstart) {
                        try {
                            const fn = new Function('engine', script.onstart);
                            fn(this);
                            this.logMessage('System', `Script ${script.name} restarted successfully.`, 'success');
                        } catch(e) {
                            this.logMessage('Script Error', `Restart failed for ${script.name}: ${e.message}`, 'error');
                        }
                    } else {
                        this.logMessage('System', `Script ${script.name} saved.`, 'success');
                    }
                    populateScriptsList();
                    scriptSelect.value = name;
                }
            });
        }
    }

    logMessage(title, message, type) {
        if (this.consoleMuted) return;

        const container = document.getElementById('log-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = `log-entry log-${type}`;
        div.innerHTML = `<strong>${title}:</strong> ${message}`;
        container.appendChild(div);
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;

        setTimeout(() => {
            if(div.parentElement) {
                div.style.opacity = '0';
                div.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    if(div.parentElement) div.parentElement.removeChild(div);
                }, 300);
            }
        }, 8000);
    }
}

window.onload = () => {
    window.engine = new Engine();
};
