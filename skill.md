# ThreeQuery AI Cheat Sheet & Reference Guide

This file provides a compact, precise reference for AI models to programmatically interact with the ThreeQuery engine via **query commands** and **JavaScript scripting**.

---

## 1. Command Query Syntax Reference

Queries are strings sent to `/api/query` or run via `engine.executeQuery("...")`.

### SPAWN Command
Creates objects inside the engine.
```
spawn type=[mesh|light|transform|skybox|collision|character|script] name=[unique_name] [properties...]
```

#### Object Types & Specific Properties:
*   **`type=mesh`**: Spawn 3D geometric shapes.
    *   `shape=[box|sphere|plane]` (default: `box`)
    *   `color=[hex_color]` (default: `#a855f7`)
    *   `position=[x,y,z]` (default: `0,0,0`)
    *   `scale=[x,y,z]` (default: `1,1,1`)
    *   *Built-in Movement:* `moveSpeed=[num]` `moveDirection=[x,y,z|shortcut]` `moveInput=[key_name]`
    *   *Built-in Rotation:* `rotateSpeed=[num_deg_per_sec]` `rotateDirection=[x,y,z|shortcut]` `rotateInput=[key_name]`
*   **`type=light`**: Add illumination.
    *   `ltype=[point|directional|ambient]` (default: `point`)
    *   `color=[hex_color]` (default: `#ffffff`)
    *   `intensity=[float]` (default: `1`)
    *   `position=[x,y,z]`
*   **`type=transform`**: Invisible group/pivot node.
    *   `position=[x,y,z]`, `scale=[x,y,z]`
*   **`type=skybox`**: Sets background and fog colors.
    *   `color=[hex_color]`
*   **`type=collision`**: Adds Rapier physics rigid body/collider to an existing mesh.
    *   `target=[target_mesh_name]` (required)
    *   `shape=[box|sphere]` (default: `box`)
    *   `static=[true|false]` (default: `false` for dynamic physics)
*   **`type=character`**: Spawns WASD + Mouse look First Person Controller.
    *   `name=[name]` (default: `player`)
    *   `position=[x,y,z]` (default: `0,2,0`)
*   **`type=script`**: Register custom JavaScript logic behaviors.
    *   `target=[object_name]` (target object name to run script relative to)
    *   `onstart='[js_code]'` (runs once on load)
    *   `onupdate='[js_code]'` (runs every frame)

### MODIFY Command
Updates properties of an existing object (or the global skybox).
```
modify name=[object_name] [properties...]
```
*   **Modifiable Properties**: `position=[x,y,z]`, `rotation=[x,y,z]` (in degrees), `scale=[x,y,z]`, `color=[hex]`, `intensity=[float]`.
*   **Animation Update**: Can overwrite `moveSpeed`, `moveDirection`/`moveDir`, `moveInput`/`moveKey`, `rotateSpeed`, `rotateDirection`/`rotateDir`, `rotateInput`/`rotateKey`.
*   *Note:* Modifying skybox color is done with `modify name=skybox color=[hex]`.

### OTHER Commands
*   **`link child=[child_name] parent=[parent_name]`**: Parents child mesh under parent (inherits group transforms).
*   **`delete name=[object_name]`**: Removes object from scene and clears its physics.
*   **`get name=[object_name|all]`**: Outputs object state to UI console.

---

## 2. Animation Direction & Keyboard Input Shortcuts

### Direction Shortcuts:
When using `moveDirection` or `rotateDirection`, you can use standard coordinates `x,y,z` (e.g. `0,1,0`) or strings:
*   `x` / `left` / `right`
*   `y` / `up` / `down`
*   `z` / `forward` / `back`

### Input Trigger Key Strings:
Set on `moveInput` or `rotateInput` to activate animation only when held:
*   `w`, `a`, `s`, `d` (letters)
*   `up_arrow`, `down_arrow`, `left_arrow`, `right_arrow`
*   `space`

---

## 3. JavaScript Scripting API Reference

Used inside `onstart` and `onupdate` script attributes.
*   `onstart` receives local scope with `engine` available.
*   `onupdate` receives two parameters: `engine` and `dt` (delta time since last frame).

### `engine` Object Interface:

#### Key Properties:
*   `engine.objects`: `Map` containing all spawned objects. Get an object via `engine.objects.get(name)`.
*   `engine.scene`: `THREE.Scene` instance.
*   `engine.camera`: `THREE.PerspectiveCamera` instance.
*   `engine.renderer`: `THREE.WebGLRenderer` instance.
*   `engine.controls`: `OrbitControls` instance. (Toggle via `engine.controls.enabled = false`).
*   `engine.world`: `RAPIER.World` instance (physics solver).
*   `engine.activeKeys`: `Object` tracking active keys (e.g., `engine.activeKeys['w']`, `engine.activeKeys['arrowleft']`).
*   `engine.character`: `{ name, rigidBody, speed }` metadata if character is active.

#### Key Methods:
*   `engine.logMessage(title, message, type)`: Prints to frontend panel console.
    *   `type`: `'info'` (blue), `'success'` (green), `'error'` (red)
*   `engine.executeQuery(queryString)`: Asynchronously runs a ThreeQuery command string.

### Object Structures inside `engine.objects.get(name)`:
```javascript
{
  name: "object_name",
  type: "mesh" | "light" | "transform" | "skybox",
  mesh: THREE.Object3D, // THREE.Mesh, THREE.Group, or THREE.Light
  children: ["child_name_1", ...],
  parent: "parent_name" || null,
  rigidBody: RAPIER.RigidBody || undefined, // Rapier physics object
  animate: {
    moveSpeed: Number,
    moveDir: THREE.Vector3,
    moveInput: String,
    rotateSpeed: Number,
    rotateDir: THREE.Vector3,
    rotateInput: String
  }
}
```

---

## 4. Key Scripting and Query Examples

### Example A: Basic Environment Setup (Queries)
```bash
# Setup sky, lighting, and static floor with physics
spawn type=skybox color=#0a0a16
spawn type=light ltype=ambient color=#ffffff intensity=0.5
spawn type=mesh shape=box name=ground position=0,-0.5,0 scale=100,1,100 color=#1e1e2f
spawn type=collision target=ground shape=box static=true
```

### Example B: Character Spawning & Manual Setup
```bash
# Spawn player character controller
spawn type=character name=hero position=0,5,0
```

### Example C: Orbiting Obstacles (Linking)
```bash
# Create pivot point, orbit it, and link visual spheres
spawn type=transform name=pivot position=0,2,0
modify name=pivot rotateSpeed=90 rotateDirection=y
spawn type=mesh shape=sphere name=orbiter color=#ff00aa position=5,0,0
link child=orbiter parent=pivot
```

### Example D: Script Injection with Keyboard Controls & Custom Camera (onupdate)
```javascript
// Command to spawn a controllable hovercraft and attach a follow camera
spawn type=script name=game_logic target=player onupdate='
const player = engine.objects.get("player");
if (player && player.mesh) {
    const mesh = player.mesh;
    const speed = 10;
    
    // Custom controls
    if (engine.activeKeys["w"]) { mesh.position.z -= speed * dt; }
    if (engine.activeKeys["s"]) { mesh.position.z += speed * dt; }
    if (engine.activeKeys["a"]) { mesh.position.x -= speed * dt; }
    if (engine.activeKeys["d"]) { mesh.position.x += speed * dt; }
    
    // Disable OrbitControls to use custom Chase Camera
    if (engine.controls) { engine.controls.enabled = false; }
    engine.camera.position.set(mesh.position.x, mesh.position.y + 3, mesh.position.z + 8);
    engine.camera.lookAt(mesh.position);
}
'
```

### Example E: Physics Collision and Target Re-spawner (onupdate)
```javascript
// Resets physics-enabled "ball" when it falls off the platform
spawn type=script name=respawner target=ball onupdate='
const ball = engine.objects.get("ball");
if (ball && ball.mesh && ball.rigidBody) {
    const pos = ball.mesh.position;
    if (pos.y < -10) {
        // Reset translation on the Rapier rigid body directly
        ball.rigidBody.setTranslation({ x: 0, y: 15, z: 0 }, true);
        ball.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        engine.logMessage("Physics", "Ball reset to spawn point!", "info");
    }
}
'
```
