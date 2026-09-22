/* =========================================================
   ARI CRAFT · v0.3.1
   Google Login + Cloud Save + Desktop + Mobile
   ========================================================= */

import * as THREE from 'three';

import {
    PointerLockControls
} from 'three/addons/controls/PointerLockControls.js';


/* =========================================================
   FIREBASE
   ========================================================= */

import {
    initializeApp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';


/* =========================================================
   CONFIGURACIÓN FIREBASE
   ========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyDFe32AgdruOh_sUn8_O5NGAF2NDItP5jU",

    authDomain:
        "ari-craft.firebaseapp.com",

    projectId:
        "ari-craft",

    storageBucket:
        "ari-craft.firebasestorage.app",

    messagingSenderId:
        "787816491408",

    appId:
        "1:787816491408:web:7872b943b9540df6992b15"
};


const firebaseApp =
    initializeApp(firebaseConfig);

const auth =
    getAuth(firebaseApp);

const db =
    getFirestore(firebaseApp);

const googleProvider =
    new GoogleAuthProvider();

googleProvider.setCustomParameters({
    prompt: 'select_account'
});


/* =========================================================
   DISPOSITIVO
   ========================================================= */

const isTouch =
    matchMedia(
        '(hover: none) and (pointer: coarse)'
    ).matches ||
    navigator.maxTouchPoints > 0;


/* =========================================================
   INTERFAZ
   ========================================================= */

const startScreen =
    document.querySelector('#start');

const googleLoginButton =
    document.querySelector('#googleLoginButton');

const playerInfo =
    document.querySelector('#playerInfo');

const playerName =
    document.querySelector('#playerName');

const startButton =
    document.querySelector('#startButton');


/* =========================================================
   USUARIO
   ========================================================= */

let currentUser = null;
let worldLoaded = false;


/* =========================================================
   LOGIN GOOGLE
   ========================================================= */

async function loginWithGoogle() {

    googleLoginButton.disabled = true;

    googleLoginButton.textContent =
        'CONECTANDO...';

    try {

        const result =
            await signInWithPopup(
                auth,
                googleProvider
            );

        currentUser =
            result.user;

    } catch (error) {

        console.error(
            'Error Google Login:',
            error
        );

        googleLoginButton.disabled =
            false;

        googleLoginButton.textContent =
            '🔐 ENTRAR CON GOOGLE';


        if (
            error.code ===
            'auth/popup-blocked'
        ) {

            alert(
                'El navegador ha bloqueado la ventana de Google.\n\nPermite las ventanas emergentes para ARI CRAFT y vuelve a intentarlo.'
            );

        } else if (
            error.code !==
            'auth/popup-closed-by-user'
        ) {

            alert(
                'No se pudo iniciar sesión con Google.\n\n' +
                (error.code || error.message)
            );
        }
    }
}


googleLoginButton.addEventListener(
    'click',
    loginWithGoogle
);


/* =========================================================
   MANTENER SESIÓN
   ========================================================= */

setPersistence(
    auth,
    browserLocalPersistence
)
.catch(error => {

    console.error(
        'Error manteniendo sesión:',
        error
    );
});


/* =========================================================
   ESTADO DE AUTENTICACIÓN
   ========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            currentUser =
                null;

            worldLoaded =
                false;

            googleLoginButton.style.display =
                'block';

            googleLoginButton.disabled =
                false;

            googleLoginButton.textContent =
                '🔐 ENTRAR CON GOOGLE';

            playerInfo.style.display =
                'none';

            return;
        }


        currentUser =
            user;


        const name =
            user.displayName
                ? user.displayName.split(' ')[0]
                : 'Jugador';


        playerName.textContent =
            name;


        googleLoginButton.style.display =
            'none';

        playerInfo.style.display =
            'block';


        if (!worldLoaded) {

            await loadWorld();

            worldLoaded =
                true;
        }
    }
);


/* =========================================================
   ESCENA
   ========================================================= */

const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(
        0x82c9ee
    );

scene.fog =
    new THREE.Fog(
        0x82c9ee,
        35,
        100
    );


const camera =
    new THREE.PerspectiveCamera(
        72,
        innerWidth / innerHeight,
        0.1,
        160
    );

camera.position.set(
    0,
    2.2,
    10
);


const renderer =
    new THREE.WebGLRenderer({
        antialias: true,
        powerPreference:
            'high-performance'
    });


renderer.setSize(
    innerWidth,
    innerHeight
);

renderer.setPixelRatio(
    Math.min(
        devicePixelRatio,
        2
    )
);

renderer.shadowMap.enabled =
    true;


document
    .querySelector('#game')
    .appendChild(
        renderer.domElement
    );


/* =========================================================
   ILUMINACIÓN
   ========================================================= */

scene.add(
    new THREE.HemisphereLight(
        0xdff4ff,
        0x557744,
        2.1
    )
);


const sun =
    new THREE.DirectionalLight(
        0xffffff,
        2.3
    );

sun.position.set(
    25,
    40,
    15
);

sun.castShadow =
    true;

scene.add(sun);


/* =========================================================
   BLOQUES Y MATERIALES
   ========================================================= */

const blockGeometry =
    new THREE.BoxGeometry(
        1,
        1,
        1
    );


const materials = [

    new THREE.MeshLambertMaterial({
        color: 0x58a936
    }),

    new THREE.MeshLambertMaterial({
        color: 0xb35c38
    }),

    new THREE.MeshLambertMaterial({
        color: 0x777a7d
    }),

    new THREE.MeshLambertMaterial({
        color: 0xe2b735
    }),

    new THREE.MeshLambertMaterial({
        color: 0x8b572a
    }),

    new THREE.MeshLambertMaterial({
        color: 0x3d8d38
    })

];


const blocks = [];
const playerBlocks = [];


/* =========================================================
   CREAR BLOQUE
   ========================================================= */

function createBlock(
    x,
    y,
    z,
    type = 0,
    removable = true,
    createdByPlayer = false
) {

    const block =
        new THREE.Mesh(
            blockGeometry,
            materials[type]
        );


    block.position.set(
        x,
        y,
        z
    );


    block.userData.type =
        type;

    block.userData.removable =
        removable;

    block.userData.createdByPlayer =
        createdByPlayer;


    block.castShadow =
        true;

    block.receiveShadow =
        true;


    scene.add(block);

    blocks.push(block);


    if (createdByPlayer) {

        playerBlocks.push(
            block
        );
    }


    return block;
}


/* =========================================================
   TERRENO
   ========================================================= */

for (
    let x = -20;
    x <= 20;
    x++
) {

    for (
        let z = -20;
        z <= 20;
        z++
    ) {

        createBlock(
            x,
            0,
            z,
            0,
            false,
            false
        );
    }
}


/* =========================================================
   ÁRBOLES
   ========================================================= */

function createTree(x, z) {

    createBlock(
        x,1,z,
        4,true,false
    );

    createBlock(
        x,2,z,
        4,true,false
    );

    createBlock(
        x,3,z,
        4,true,false
    );


    for (
        let dx = -1;
        dx <= 1;
        dx++
    ) {

        for (
            let dz = -1;
            dz <= 1;
            dz++
        ) {

            createBlock(
                x + dx,
                4,
                z + dz,
                5,
                true,
                false
            );
        }
    }


    createBlock(
        x,
        5,
        z,
        5,
        true,
        false
    );
}


[
    [-14,-13],
    [13,-14],
    [-16,5],
    [15,8],
    [-12,13],
    [12,14]

].forEach(
    ([x,z]) =>
        createTree(x,z)
);


/* =========================================================
   FÚTBOL
   ========================================================= */

const white =
    new THREE.MeshLambertMaterial({
        color: 0xffffff
    });


function beam(
    x,y,z,
    sx,sy,sz
) {

    const mesh =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                sx,
                sy,
                sz
            ),

            white
        );


    mesh.position.set(
        x,y,z
    );

    mesh.castShadow =
        true;

    scene.add(mesh);

    return mesh;
}


/* Portería */

beam(
    -3,1.5,-13,
    .22,3,.22
);

beam(
    3,1.5,-13,
    .22,3,.22
);

beam(
    0,3,-13,
    6.2,.22,.22
);


/* Línea */

for (
    let x = -4;
    x <= 4;
    x++
) {

    const line =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                .8,
                .025,
                .15
            ),

            white
        );


    line.position.set(
        x,
        .52,
        -10
    );

    scene.add(line);
}


/* =========================================================
   BALÓN
   ========================================================= */

const ball =
    new THREE.Mesh(

        new THREE.SphereGeometry(
            .42,
            24,
            24
        ),

        new THREE.MeshLambertMaterial({
            color: 0xf5f5f5
        })
    );


ball.position.set(
    0,
    .95,
    -5
);

ball.castShadow =
    true;

scene.add(ball);


let ballVelocity =
    new THREE.Vector3();


/* =========================================================
   DESKTOP
   ========================================================= */

const desktopControls =
    new PointerLockControls(
        camera,
        document.body
    );


const keys = {};


document.addEventListener(
    'keydown',
    e => {

        keys[e.code] =
            true;


        if (
            e.code === 'Space'
        ) {

            jump();
        }


        const n =
            Number(e.key);


        if (
            n >= 1 &&
            n <= 4
        ) {

            selectBlock(
                n - 1
            );
        }
    }
);


document.addEventListener(
    'keyup',
    e => {

        keys[e.code] =
            false;
    }
);


/* =========================================================
   CÁMARA MÓVIL
   ========================================================= */

let yaw = 0;
let pitch = 0;


const lookZone =
    document.querySelector(
        '#lookZone'
    );


let lookPointer =
    null;

let lastLookX = 0;
let lastLookY = 0;


lookZone.addEventListener(
    'pointerdown',
    e => {

        if (!isTouch) return;


        lookPointer =
            e.pointerId;

        lastLookX =
            e.clientX;

        lastLookY =
            e.clientY;


        lookZone.setPointerCapture(
            e.pointerId
        );
    }
);


lookZone.addEventListener(
    'pointermove',
    e => {

        if (
            e.pointerId !==
            lookPointer
        ) return;


        const dx =
            e.clientX -
            lastLookX;

        const dy =
            e.clientY -
            lastLookY;


        lastLookX =
            e.clientX;

        lastLookY =
            e.clientY;


        yaw -=
            dx * .004;

        pitch -=
            dy * .004;


        pitch =
            THREE.MathUtils.clamp(
                pitch,
                -Math.PI / 2.1,
                Math.PI / 2.1
            );


        camera.rotation.order =
            'YXZ';

        camera.rotation.y =
            yaw;

        camera.rotation.x =
            pitch;
    }
);


function endLook(e) {

    if (
        e.pointerId ===
        lookPointer
    ) {

        lookPointer =
            null;
    }
}


lookZone.addEventListener(
    'pointerup',
    endLook
);

lookZone.addEventListener(
    'pointercancel',
    endLook
);


/* =========================================================
   JOYSTICK
   ========================================================= */

const joystick =
    document.querySelector(
        '#joystickZone'
    );

const stick =
    document.querySelector(
        '#joystickStick'
    );


let joystickPointer =
    null;

let joyX = 0;
let joyY = 0;


joystick.addEventListener(
    'pointerdown',
    e => {

        joystickPointer =
            e.pointerId;


        joystick.setPointerCapture(
            e.pointerId
        );


        updateJoystick(e);
    }
);


joystick.addEventListener(
    'pointermove',
    e => {

        if (
            e.pointerId !==
            joystickPointer
        ) return;


        updateJoystick(e);
    }
);


function updateJoystick(e) {

    const rect =
        joystick
            .getBoundingClientRect();


    const cx =
        rect.left +
        rect.width / 2;

    const cy =
        rect.top +
        rect.height / 2;


    let dx =
        e.clientX - cx;

    let dy =
        e.clientY - cy;


    const radius =
        rect.width * .32;


    const distance =
        Math.hypot(
            dx,
            dy
        );


    if (
        distance >
        radius
    ) {

        dx =
            dx /
            distance *
            radius;

        dy =
            dy /
            distance *
            radius;
    }


    joyX =
        dx / radius;

    joyY =
        dy / radius;


    stick.style.transform =
        `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}


function resetJoystick() {

    joystickPointer =
        null;

    joyX = 0;
    joyY = 0;


    stick.style.transform =
        'translate(-50%, -50%)';
}


joystick.addEventListener(
    'pointerup',
    resetJoystick
);

joystick.addEventListener(
    'pointercancel',
    resetJoystick
);


/* =========================================================
   SALTO
   ========================================================= */

let verticalVelocity = 0;
let grounded = true;


function jump() {

    if (!grounded) return;


    verticalVelocity =
        7;

    grounded =
        false;
}


document
    .querySelector('#jumpButton')
    .addEventListener(
        'pointerdown',
        e => {

            e.preventDefault();

            jump();
        }
    );


/* =========================================================
   HOTBAR
   ========================================================= */

let selectedType = 0;


function selectBlock(index) {

    selectedType =
        index;


    document
        .querySelectorAll('.slot')
        .forEach(
            (slot,i) => {

                slot.classList.toggle(
                    'active',
                    i === selectedType
                );
            }
        );
}


document
    .querySelectorAll('.slot')
    .forEach(
        (slot,index) => {

            slot.addEventListener(
                'pointerdown',
                e => {

                    e.preventDefault();
                    e.stopPropagation();

                    selectBlock(
                        index
                    );
                }
            );
        }
    );


/* =========================================================
   RAYCAST
   ========================================================= */

const raycaster =
    new THREE.Raycaster();

raycaster.far =
    6;


function getTarget() {

    raycaster.setFromCamera(
        new THREE.Vector2(
            0,
            0
        ),
        camera
    );


    const hits =
        raycaster.intersectObjects(
            blocks,
            false
        );


    return hits.length
        ? hits[0]
        : null;
}


/* =========================================================
   ROMPER
   ========================================================= */

function breakBlock() {

    const hit =
        getTarget();


    if (!hit) return;


    if (
        !hit.object
            .userData
            .removable
    ) {

        showMessage(
            'Ese bloque forma parte del terreno'
        );

        return;
    }


    if (
        hit.object
            .userData
            .createdByPlayer
    ) {

        const playerIndex =
            playerBlocks.indexOf(
                hit.object
            );


        if (
            playerIndex !== -1
        ) {

            playerBlocks.splice(
                playerIndex,
                1
            );
        }
    }


    scene.remove(
        hit.object
    );


    const index =
        blocks.indexOf(
            hit.object
        );


    if (
        index !== -1
    ) {

        blocks.splice(
            index,
            1
        );
    }


    scheduleSave();
}


/* =========================================================
   CONSTRUIR
   ========================================================= */

function placeBlock() {

    const hit =
        getTarget();


    if (!hit) return;


    const position =
        hit.object
            .position
            .clone()
            .add(
                hit.face.normal
            );


    position.set(
        Math.round(position.x),
        Math.round(position.y),
        Math.round(position.z)
    );


    if (
        position.distanceTo(
            camera.position
        ) < 1.5
    ) {

        return;
    }


    const exists =
        blocks.some(
            block =>

                block.position.x ===
                    position.x &&

                block.position.y ===
                    position.y &&

                block.position.z ===
                    position.z
        );


    if (exists) {

        showMessage(
            'Ya hay un bloque ahí'
        );

        return;
    }


    createBlock(
        position.x,
        position.y,
        position.z,
        selectedType,
        true,
        true
    );


    scheduleSave();
}


/* =========================================================
   RATÓN
   ========================================================= */

renderer.domElement.addEventListener(
    'mousedown',
    e => {

        if (isTouch) return;

        if (
            !desktopControls
                .isLocked
        ) return;


        if (
            e.button === 0
        ) {

            breakBlock();
        }


        if (
            e.button === 2
        ) {

            placeBlock();
        }
    }
);


renderer.domElement.addEventListener(
    'contextmenu',
    e =>
        e.preventDefault()
);


/* =========================================================
   BOTONES MÓVILES
   ========================================================= */

document
    .querySelector('#breakButton')
    .addEventListener(
        'pointerdown',
        e => {

            e.preventDefault();

            breakBlock();
        }
    );


document
    .querySelector('#placeButton')
    .addEventListener(
        'pointerdown',
        e => {

            e.preventDefault();

            placeBlock();
        }
    );


/* =========================================================
   MENSAJES
   ========================================================= */

let messageTimer;


function showMessage(text) {

    const element =
        document.querySelector(
            '#gameMessage'
        );


    element.textContent =
        text;


    element.classList.add(
        'visible'
    );


    clearTimeout(
        messageTimer
    );


    messageTimer =
        setTimeout(
            () => {

                element
                    .classList
                    .remove(
                        'visible'
                    );

            },
            1600
        );
}


/* =========================================================
   GUARDAR
   ========================================================= */

let saveTimer = null;


function scheduleSave() {

    if (!currentUser) return;


    clearTimeout(
        saveTimer
    );


    saveTimer =
        setTimeout(
            saveWorld,
            700
        );
}


async function saveWorld() {

    if (!currentUser) return;


    const savedBlocks =
        playerBlocks.map(
            block => ({

                x:
                    block.position.x,

                y:
                    block.position.y,

                z:
                    block.position.z,

                type:
                    block.userData.type
            })
        );


    const gameData = {

        version: 1,

        player: {

            x:
                camera.position.x,

            y:
                camera.position.y,

            z:
                camera.position.z
        },

        blocks:
            savedBlocks,

        updatedAt:
            serverTimestamp()
    };


    try {

        await setDoc(

            doc(
                db,
                'players',
                currentUser.uid
            ),

            gameData,

            {
                merge: true
            }
        );


        console.log(
            'ARI CRAFT guardado ☁️'
        );


    } catch (error) {

        console.error(
            'Error guardando:',
            error
        );


        showMessage(
            '⚠️ No se pudo guardar'
        );
    }
}


/* =========================================================
   CARGAR
   ========================================================= */

async function loadWorld() {

    if (!currentUser) return;


    try {

        const playerDocument =
            await getDoc(

                doc(
                    db,
                    'players',
                    currentUser.uid
                )
            );


        if (
            !playerDocument.exists()
        ) {

            showMessage(
                '🌍 ¡Bienvenido a tu nuevo mundo!'
            );


            await saveWorld();

            return;
        }


        const data =
            playerDocument.data();


        /* POSICIÓN */

        if (
            data.player &&
            Number.isFinite(
                data.player.x
            ) &&
            Number.isFinite(
                data.player.y
            ) &&
            Number.isFinite(
                data.player.z
            )
        ) {

            camera.position.set(

                data.player.x,

                Math.max(
                    2.2,
                    data.player.y
                ),

                data.player.z
            );
        }


        /* BLOQUES */

        if (
            Array.isArray(
                data.blocks
            )
        ) {

            data.blocks.forEach(
                savedBlock => {

                    const type =
                        Number(
                            savedBlock.type
                        );


                    if (
                        !Number.isFinite(
                            savedBlock.x
                        ) ||
                        !Number.isFinite(
                            savedBlock.y
                        ) ||
                        !Number.isFinite(
                            savedBlock.z
                        ) ||
                        !Number.isInteger(
                            type
                        ) ||
                        type < 0 ||
                        type > 3
                    ) {

                        return;
                    }


                    const exists =
                        blocks.some(
                            block =>

                                block.position.x ===
                                    savedBlock.x &&

                                block.position.y ===
                                    savedBlock.y &&

                                block.position.z ===
                                    savedBlock.z
                        );


                    if (!exists) {

                        createBlock(

                            savedBlock.x,

                            savedBlock.y,

                            savedBlock.z,

                            type,

                            true,

                            true
                        );
                    }
                }
            );
        }


        showMessage(
            '☁️ Mundo cargado'
        );


    } catch (error) {

        console.error(
            'Error cargando:',
            error
        );


        showMessage(
            '⚠️ No se pudo cargar el mundo'
        );
    }
}


/* =========================================================
   ENTRAR AL JUEGO
   ========================================================= */

startButton.addEventListener(
    'click',
    () => {

        if (!currentUser) {

            showMessage(
                'Primero entra con Google'
            );

            return;
        }


        startScreen.style.display =
            'none';


        if (!isTouch) {

            desktopControls.lock();
        }


        scheduleSave();
    }
);


desktopControls.addEventListener(
    'unlock',
    () => {

        if (!isTouch) {

            startScreen.style.display =
                'grid';

            scheduleSave();
        }
    }
);


/* =========================================================
   MOVIMIENTO
   ========================================================= */

function movePlayer(delta) {

    let forward = 0;
    let right = 0;


    if (isTouch) {

        forward =
            -joyY;

        right =
            joyX;

    } else {

        if (
            keys['KeyW']
        ) {

            forward += 1;
        }

        if (
            keys['KeyS']
        ) {

            forward -= 1;
        }

        if (
            keys['KeyD']
        ) {

            right += 1;
        }

        if (
            keys['KeyA']
        ) {

            right -= 1;
        }
    }


    const length =
        Math.hypot(
            forward,
            right
        );


    if (
        length > 1
    ) {

        forward /=
            length;

        right /=
            length;
    }


    const speed =
        6 * delta;


    if (isTouch) {

        const direction =
            new THREE.Vector3();


        camera.getWorldDirection(
            direction
        );


        direction.y =
            0;

        direction.normalize();


        const side =
            new THREE.Vector3(
                direction.z,
                0,
                -direction.x
            );


        camera.position
            .addScaledVector(
                direction,
                forward * speed
            );


        camera.position
            .addScaledVector(
                side,
                right * speed
            );

    } else {

        desktopControls
            .moveForward(
                forward * speed
            );


        desktopControls
            .moveRight(
                right * speed
            );
    }


    camera.position.x =
        THREE.MathUtils.clamp(
            camera.position.x,
            -19,
            19
        );


    camera.position.z =
        THREE.MathUtils.clamp(
            camera.position.z,
            -19,
            19
        );
}


/* =========================================================
   BALÓN
   ========================================================= */

function updateBall(delta) {

    const playerFlat =
        new THREE.Vector3(

            camera.position.x,

            ball.position.y,

            camera.position.z
        );


    const distance =
        playerFlat.distanceTo(
            ball.position
        );


    if (
        distance < 1.35
    ) {

        const direction =
            ball.position
                .clone()
                .sub(
                    playerFlat
                )
                .normalize();


        ballVelocity
            .addScaledVector(
                direction,
                4.5 * delta
            );
    }


    ball.position
        .addScaledVector(
            ballVelocity,
            delta
        );


    ballVelocity
        .multiplyScalar(

            Math.pow(
                .965,
                delta * 60
            )
        );


    ball.position.y =
        .95;


    if (
        Math.abs(
            ball.position.x
        ) > 19
    ) {

        ball.position.x =
            Math.sign(
                ball.position.x
            ) * 19;


        ballVelocity.x *=
            -.7;
    }


    if (
        Math.abs(
            ball.position.z
        ) > 19
    ) {

        ball.position.z =
            Math.sign(
                ball.position.z
            ) * 19;


        ballVelocity.z *=
            -.7;
    }


    if (

        ball.position.z <
            -12.7 &&

        Math.abs(
            ball.position.x
        ) < 2.8

    ) {

        showMessage(
            '⚽ ¡GOOOOOOL! ⚽'
        );


        ball.position.set(
            0,
            .95,
            -5
        );


        ballVelocity.set(
            0,
            0,
            0
        );
    }
}


/* =========================================================
   AUTOGUARDADO
   ========================================================= */

setInterval(
    () => {

        if (
            currentUser &&
            startScreen.style.display ===
                'none'
        ) {

            saveWorld();
        }

    },
    15000
);


document.addEventListener(
    'visibilitychange',
    () => {

        if (
            document.hidden &&
            currentUser
        ) {

            saveWorld();
        }
    }
);


/* =========================================================
   GAME LOOP
   ========================================================= */

const clock =
    new THREE.Clock();


function animate() {

    requestAnimationFrame(
        animate
    );


    const delta =
        Math.min(
            clock.getDelta(),
            .05
        );


    const playing =

        isTouch

            ? startScreen
                .style
                .display ===
                'none'

            : desktopControls
                .isLocked;


    if (playing) {

        movePlayer(
            delta
        );


        verticalVelocity -=
            18 * delta;


        camera.position.y +=
            verticalVelocity *
            delta;


        if (
            camera.position.y <=
            2.2
        ) {

            camera.position.y =
                2.2;

            verticalVelocity =
                0;

            grounded =
                true;
        }


        updateBall(
            delta
        );
    }


    renderer.render(
        scene,
        camera
    );
}


animate();


/* =========================================================
   RESIZE
   ========================================================= */

addEventListener(
    'resize',
    () => {

        camera.aspect =
            innerWidth /
            innerHeight;


        camera
            .updateProjectionMatrix();


        renderer.setSize(
            innerWidth,
            innerHeight
        );
    }
);
