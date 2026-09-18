// 构建开场动画的静态 SVG 场景，并把 27 拍映射为可复现的视觉状态。

const BEATS = [
  ['scene-black beat-0 luggage-drag', [0, 0, 480, 270], ['travel-case', 'broken-wheel'], 2600],
  ['scene-city beat-1 dawn-1', [0, 0, 480, 270], ['city-sky', 'fog-bands'], 1800],
  ['scene-city beat-2 dawn-2 city-active', [12, 6.75, 456, 256.5], ['steamer', 'steam', 'city-bus', 'security-guard', 'fallen-sign'], 2400],
  ['scene-city beat-3 dawn-3 city-still', [12, 6.75, 456, 256.5], ['fog-bands'], 1600],
  ['scene-city beat-4 dawn-4 bridge-reveal', [24, 27, 432, 243], ['bridge-deck', 'bridge-pillars'], 2200],
  ['scene-bridge beat-5 pose-x-crouch pose-f-stand show-bags', [54, 60.75, 372, 209.25], ['xuan', 'fan', 'camp-bags', 'travel-case-open'], 2200],
  ['scene-bridge beat-6 pose-x-crouch pose-f-bend bag-care', [54, 60.75, 372, 209.25], ['fan', 'camera-bag', 'jacket-pad'], 2400],
  ['scene-bridge beat-7 pose-x-crouch pose-f-stand phone-x', [60, 64.125, 360, 202.5], ['xuan-phone', 'xuan'], 3200],
  ['scene-bridge beat-8 pose-x-crouch pose-f-stand phone-x', [66, 67.5, 348, 195.75], ['xuan-phone', 'xuan', 'fan'], 3000],
  ['scene-bridge beat-9 pose-x-crouch pose-f-stand lighter', [54, 60.75, 372, 209.25], ['cigarette-pack', 'shared-cigarettes', 'lighter-sparks', 'lighter-flame'], 3200],
  ['scene-bridge beat-10 pose-x-crouch pose-f-look smoke ding', [84, 60.75, 372, 209.25], ['cigarette-tips', 'smoke-curves', 'stall-ding'], 2200],
  ['scene-bridge beat-11 pose-x-crouch pose-f-stand smoke', [60, 64.125, 360, 202.5], ['smoke-curves', 'xuan', 'fan'], 3000],
  ['scene-bridge beat-12 pose-x-crouch pose-f-inspect smoke', [66, 67.5, 348, 195.75], ['fan-cigarette', 'smoke-curves'], 2800],
  ['scene-bridge beat-13 pose-x-crouch pose-f-protect car-dust', [54, 60.75, 372, 209.25], ['headlight-sweep', 'joint-dust', 'camera-bag'], 2800],
  ['scene-bridge beat-14 pose-x-crouch pose-f-stand', [60, 64.125, 360, 202.5], ['xuan', 'fan', 'camera-bag'], 2800],
  ['scene-bridge beat-15 pose-x-crouch pose-f-sit phone-f', [72, 60.75, 372, 209.25], ['fan-phone', 'fan', 'bridge-pillar-right'], 3400],
  ['scene-bridge beat-16 pose-x-crouch pose-f-sit', [72, 60.75, 372, 209.25], ['fan', 'xuan'], 3600],
  ['scene-bridge beat-17 pose-x-crouch pose-f-sit charger', [72, 60.75, 372, 209.25], ['charger-cable', 'laptop-bag'], 2800],
  ['scene-bridge beat-18 pose-x-point pose-f-sit clouds', [72, 60.75, 372, 209.25], ['xuan-point-arm', 'low-clouds', 'fan'], 3600],
  ['scene-bridge beat-19 pose-x-crouch pose-f-draw drawing', [54, 60.75, 372, 209.25], ['cardboard-drawing', 'marker'], 3600],
  ['scene-bridge beat-20 pose-x-near pose-f-draw drawing', [54, 60.75, 372, 209.25], ['cardboard-drawing', 'marker', 'xuan'], 3600],
  ['scene-bridge beat-21 pose-x-near pose-f-draw drawing bike stall', [84, 47.25, 396, 222.75], ['street-bike', 'empty-bottle', 'stall-owner', 'stuck-table'], 3800],
  ['scene-bridge beat-22 pose-x-near pose-f-stand dust-off drawing stall', [84, 47.25, 396, 222.75], ['fan', 'clothes-dust', 'breakfast-stall'], 3200],
  ['scene-bridge beat-23 pose-x-near pose-f-step look-back drawing stall', [84, 47.25, 396, 222.75], ['fan', 'breakfast-stall', 'cardboard-drawing'], 3600],
  ['scene-bridge beat-24 pose-x-move pose-f-walk drawing stall', [84, 47.25, 396, 222.75], ['fan', 'xuan', 'camp-bags', 'cardboard-drawing'], 3400],
  ['scene-bridge beat-25 pose-x-move pose-f-gone drawing stall zoom-wide', [0, 0, 480, 270], ['street-depth', 'breakfast-stall', 'camp-bags'], 3200],
  ['scene-title beat-26 pose-x-move pose-f-gone drawing stall zoom-wide', [0, 0, 480, 270], ['introScene', 'street-depth', 'breakfast-stall'], 1200],
];

export function sceneForBeat(index) {
  if (!Number.isInteger(index) || index < 0 || index >= BEATS.length) throw new RangeError(`Invalid intro beat: ${index}`);
  const [className, camera, ids, duration] = BEATS[index];
  return { className, camera: [...camera], ids: [...ids], duration };
}

const SCENE = `<svg id="introScene" class="intro-scene" viewBox="0 0 480 270" role="img" aria-label="雾城清晨，桥下的轩哥和凡哥收拾临时营地">
  <defs>
    <linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1"><stop class="dawn-top" offset="0" stop-color="#101d27"/><stop class="dawn-mid" offset=".58" stop-color="#3c5057"/><stop class="dawn-low" offset="1" stop-color="#776f5e"/></linearGradient>
    <linearGradient id="roadFade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#536167"/><stop offset="1" stop-color="#2c383d"/></linearGradient>
    <radialGradient id="phoneLight"><stop stop-color="#c8edf1" stop-opacity=".68"/><stop offset="1" stop-color="#88b8c2" stop-opacity="0"/></radialGradient>
    <filter id="fogSoft" x="-10%" y="-80%" width="120%" height="260%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="dustSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".45"/></filter>
  </defs>

  <g id="black-scene">
    <rect width="480" height="270" fill="#05080b"/>
    <g id="city-afterglow" opacity=".2" fill="#435158"><path d="M366 85h23v-28h18v28h17V42h26v43h30v31H366Z"/><path d="M390 65h4v5h-4zm22 9h4v5h-4zm23-18h5v6h-5zm25 12h4v5h-4z" fill="#b7a77e"/></g>
    <g id="travel-case" transform="translate(218 200) rotate(-7)">
      <path d="M12 0h30a7 7 0 0 1 7 7v38H5V7a7 7 0 0 1 7-7Z" fill="#2b3439" stroke="#69757a" stroke-width="2"/>
      <path d="M20 0v-10h15V0M14 8v30M40 8v30" fill="none" stroke="#151b1e" stroke-width="3"/>
      <circle cx="13" cy="49" r="4" fill="#879095"/><g id="broken-wheel"><circle cx="42" cy="49" r="4" fill="#879095"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur=".55s" repeatCount="indefinite"/></g>
    </g>
    <path class="case-motion" d="M156 255c48-12 111-10 170 0" fill="none" stroke="#283137" stroke-width="2" stroke-dasharray="7 10"/><path id="ground-reflection" d="M332 242c50-7 99-6 143 2M368 251c31-4 63-3 88 1" fill="none" stroke="#586267" stroke-width="2" opacity=".18"/>
  </g>

  <g id="city-scene">
    <rect id="city-sky" width="480" height="270" fill="url(#dawnSky)"/>
    <g class="skyline skyline-far" fill="#536369"><path d="M0 130V72h34v-18h22v49h26V45h42v85h28V67h30v63h34V38h48v92h26V62h31v68h31V81h38v49h24V49h38v81Z"/></g>
    <g class="windows windows-far" fill="#d8c58e"><rect class="window" x="13" y="86" width="8" height="6"/><rect class="window" x="43" y="73" width="7" height="6"/><rect class="window" x="97" y="65" width="8" height="6"/><rect class="window" x="120" y="87" width="7" height="6"/><rect class="window" x="167" y="83" width="7" height="6"/><rect class="window" x="230" y="55" width="8" height="6"/><rect class="window" x="251" y="77" width="7" height="6"/><rect class="window" x="312" y="82" width="8" height="6"/><rect class="window" x="363" y="96" width="8" height="6"/><rect class="window" x="412" y="68" width="8" height="6"/><rect class="window" x="440" y="90" width="8" height="6"/></g>
    <g class="skyline skyline-mid" fill="#38494f"><path d="M0 160v-43h45V86h54v74h27V99h62v61h33V77h51v83h42v-54h54v54h30V91h62v69Z"/></g>
    <g class="windows windows-mid" fill="#e1c781"><rect class="window" x="12" y="128" width="10" height="7"/><rect class="window" x="66" y="106" width="10" height="7"/><rect class="window" x="80" y="130" width="10" height="7"/><rect class="window" x="142" y="117" width="9" height="7"/><rect class="window" x="230" y="96" width="10" height="7"/><rect class="window" x="251" y="122" width="10" height="7"/><rect class="window" x="334" y="125" width="10" height="7"/><rect class="window" x="422" y="111" width="10" height="7"/></g>
    <g class="skyline skyline-near" fill="#29383e"><path d="M0 180v-36h77v36h36v-49h71v49h56v-31h82v31h40v-55h75v55Z"/></g>
    <g id="fog-bands" filter="url(#fogSoft)" fill="#cbd0c9" opacity=".34"><path d="M-40 102c90-24 151 17 251-3s185-16 309 7v17c-110-18-210-16-305 3S42 117-40 128Z"/><path d="M-30 147c85-17 143 12 221-1s183-12 325 9v13c-112-14-232-13-326 0S41 158-30 163Z"/></g>
    <path id="city-road" d="M0 177h480v93H0z" fill="url(#roadFade)"/><path d="M0 212h480" stroke="#778184" stroke-width="2" stroke-dasharray="22 17" opacity=".55"/>
    <g id="city-stall" transform="translate(28 132)"><path d="M0 18h84v35H0z" fill="#765344"/><path d="M-5 13h94L76 0H10Z" fill="#c6aa78"/><path d="M8 18v35M74 18v35" stroke="#322a27" stroke-width="3"/><g id="steamer" transform="translate(28 2)"><ellipse cx="17" cy="12" rx="19" ry="5" fill="#b9b2a2"/><path d="M-2 12v11c0 4 38 4 38 0V12" fill="#8d8b82"/><path class="steamer-lid" d="M0 10Q17-1 34 10" fill="#cac3b1" stroke="#686862"/><path d="M15 2h5" stroke="#686862" stroke-width="3"/></g></g>
    <g id="steam" fill="#e8e5dc"><circle cx="55" cy="123" r="4"/><circle cx="65" cy="117" r="3"/><circle cx="73" cy="126" r="4"/><circle cx="84" cy="116" r="3"/><circle cx="47" cy="112" r="3"/><circle cx="78" cy="105" r="3"/></g>
    <g id="city-bus" transform="translate(260 167)"><path d="M2 0h91a8 8 0 0 1 8 8v28H0V8Z" fill="#7fa5a2" stroke="#263337" stroke-width="2"/><path d="M11 6h64v15H11z" fill="#c3d2d0"/><path d="M80 6h13v15H80z" fill="#9aafb0"/><circle cx="18" cy="37" r="7" fill="#1b2225"/><circle cx="83" cy="37" r="7" fill="#1b2225"/><path class="bus-brake" d="M95 23h6v8h-6" fill="#d66755"/></g>
    <g id="fallen-sign" transform="translate(404 171) rotate(-18)"><rect x="0" y="0" width="43" height="13" rx="2" fill="#9b684d"/><path d="M7 13v22m29-22v22" stroke="#564037" stroke-width="3"/></g>
    <g id="security-guard" transform="translate(389 147)"><circle cx="8" cy="7" r="6" fill="#b98565"/><path d="M1 13h14l3 26H-2Z" fill="#516878"/><path class="guard-arm" d="M2 17-8 31m23-14 12 13" fill="none" stroke="#b98565" stroke-width="4" stroke-linecap="round"/></g>
  </g>

  <g id="bridge-scene">
    <rect width="480" height="270" fill="#788586"/><path id="street-depth" d="M0 136h480v134H0z" fill="url(#roadFade)"/><path d="M0 229C90 215 168 235 255 221s139-5 225-18v67H0Z" fill="#334144"/><path d="M24 233c25-8 54-5 71 2-23 8-52 9-76 3Zm282-2c27-7 51-4 72 4-22 7-48 8-76 3Z" fill="#53676a" opacity=".7"/>
    <g id="low-clouds" fill="#c9ceca" opacity=".76"><path d="M91 132c13-15 34-8 38 4 17-10 38-1 39 12H80c-1-7 3-12 11-16Z"/><path d="M316 128c12-13 30-8 34 3 15-8 33 2 34 13h-77c0-7 3-12 9-16Z"/></g>
    <g id="bridge-deck"><path d="M0 71h480v40H0Z" fill="#424d50"/><path d="M0 71h480v11H0Z" fill="#596468"/><path d="M0 105h480v8H0Z" fill="#252d30"/><path d="M0 84h480" stroke="#737d7d" stroke-width="2" stroke-dasharray="52 3"/><path d="M154 71v40m172-40v40" stroke="#252d30" stroke-width="3"/></g>
    <g id="bridge-pillars"><path id="bridge-pillar-left" d="M18 105h53l-7 134H26Z" fill="#555f60"/><path id="bridge-pillar-right" d="M408 105h54l-8 134h-39Z" fill="#555f60"/><path d="M29 119h31m357 2h35" stroke="#6d7776" stroke-width="3"/><path d="M41 143l14 4m370 19 18-5" stroke="#3f4849" stroke-width="2"/></g>
    <path id="bridge-crack" d="M247 105l5 9-6 8 5 9" fill="none" stroke="#171d20" stroke-width="2"/>
    <g id="headlight-sweep"><path d="M-40 91 250 122 250 147-40 109Z" fill="#e8d59a" opacity=".33"/><path d="M-45 98 248 127" stroke="#f1dfad" stroke-width="3" opacity=".42"/></g>
    <g id="joint-dust" fill="#b6b2a4" filter="url(#dustSoft)"><circle cx="238" cy="118" r="2"/><circle cx="246" cy="124" r="1.8"/><circle cx="254" cy="117" r="1.4"/><circle cx="261" cy="129" r="2.1"/><circle cx="269" cy="121" r="1.5"/><circle cx="278" cy="126" r="1.7"/><circle cx="286" cy="119" r="1.4"/><circle cx="294" cy="131" r="2"/><circle cx="303" cy="122" r="1.5"/><circle cx="311" cy="128" r="1.7"/></g>

    <g id="breakfast-stall" transform="translate(410 172)"><path d="M-5 1h70l-9-13H5Z" fill="#bd805e"/><path d="M0 2h60v25H0z" fill="#6f5043"/><path d="M5 27v18m50-18v18" stroke="#302724" stroke-width="3"/><path d="M0 35h60" stroke="#d1b174" stroke-width="2"/></g>
    <g id="stuck-table" transform="translate(382 210)"><path d="M0 0h35v6H0zM5 6v22m25-22v22" stroke="#765643" stroke-width="3"/><path d="M-5 28h46" stroke="#20292c" stroke-width="3"/></g>
    <g id="stall-owner" transform="translate(388 177)"><circle cx="8" cy="7" r="6" fill="#bd8466"/><path d="M1 13h14l4 27H-3Z" fill="#82586a"/><path class="owner-arms" d="M2 18-5 31m19-13 15 13" stroke="#bd8466" stroke-width="4" stroke-linecap="round"/></g>
    <g id="stall-ding" transform="translate(437 159)"><path d="M0 8h14M3 3l-4-5m11 5 4-5" stroke="#e3bb72" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="9" r="3" fill="#e3bb72"/></g>

    <g id="cardboard" transform="translate(269 208)"><path d="M0 0h66l5 29H-3Z" fill="#b89b6c" stroke="#725f43" stroke-width="2"/><path class="cardboard-flap" d="M0 0-4-10 20-8 22 0" fill="#cbb181" stroke="#725f43"/><path d="M4 4h58M22 1v34" stroke="#cbb181" opacity=".7"/><g id="cardboard-drawing" fill="none" stroke="#493b30" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path class="draw-line draw-frame" pathLength="1" d="M11 9h43v18H11Z"/><path class="draw-line draw-people" pathLength="1" d="M21 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 0v7m-4-4h8m-7 8 3-4 3 4m17-11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 0v7m-4-4h8m-7 8 3-4 3 4m-23-15h7"/><path class="draw-line draw-roof" pathLength="1" d="m7 10 25-8 27 8M12 10V6m43 4V6"/><path class="draw-line draw-expand" pathLength="1" d="M5 6h56v24H5Z"/></g></g>
    <g id="camp-bags"><path d="M127 218q3-18 15-19t18 19Z" fill="#687679" stroke="#263136" stroke-width="2"/><path d="M151 222q3-14 15-15t18 15Z" fill="#6f7664"/><g id="travel-case-open" transform="translate(189 193)"><path d="M0 3h35v34H0z" fill="#4a4d52" stroke="#24282c" stroke-width="2"/><path d="M4 3 30-2l6 8" fill="none" stroke="#777a7c" stroke-width="3"/><circle cx="6" cy="40" r="3"/><circle cx="30" cy="40" r="3"/></g><path id="laptop-bag" d="M229 197h29v24h-29z" fill="#27363e" stroke="#12191d" stroke-width="2"/><path d="M236 197q0-9 7-9t8 9" fill="none" stroke="#27363e" stroke-width="3"/></g>
    <g id="marker" transform="translate(324 195) rotate(16)"><path d="M0 0h21v4H0z" fill="#25282b"/><path d="m21 0 5 2-5 2Z" fill="#17191b"/></g>
    <path id="jacket-pad" d="M271 203q16-8 30 1l-4 8h-28Z" fill="#8a6553"/>
    <g id="camera-bag" transform="translate(275 190)"><path d="M0 5h29v19H0z" rx="3" fill="#273239" stroke="#11181b" stroke-width="2"/><path d="M7 5q0-8 8-8t8 8" fill="none" stroke="#273239" stroke-width="3"/><circle cx="15" cy="14" r="5" fill="#11181b" stroke="#69757a"/></g>

    <g id="xuan" class="person xuan" transform="translate(173 151)"><g class="breath"><circle class="phone-cold" cx="0" cy="4" r="25" fill="url(#phoneLight)"/><circle class="head" cx="0" cy="0" r="10" fill="#bb8465"/><path d="M-9-3q9-12 18 0" fill="#263137"/><g id="xuan-glasses" fill="none" stroke="#172126" stroke-width="1.8"><rect x="-9" y="-3" width="7" height="5" rx="2"/><rect x="2" y="-3" width="7" height="5" rx="2"/><path d="M-2-1h4"/></g><path class="torso" d="M-12 12Q0 6 12 12l5 34h-34Z" fill="#344551"/><path class="arm arm-left" d="M-9 16-15 28-18 37" fill="none" stroke="#344551" stroke-width="8" stroke-linecap="round"/><circle class="joint" cx="-15" cy="28" r="4" fill="#344551"/><path class="arm arm-right" d="M9 16 15 27 20 36" fill="none" stroke="#344551" stroke-width="8" stroke-linecap="round"/><circle class="joint" cx="15" cy="27" r="4" fill="#344551"/><g class="leg-set leg-set-left"><path class="leg" d="M-7 44-14 56-10 67" fill="none" stroke="#29353c" stroke-width="9" stroke-linecap="round"/><circle class="joint" cx="-14" cy="56" r="4.5" fill="#29353c"/><path class="shoe" d="M-15 68h12" stroke="#171d20" stroke-width="5"/></g><g class="leg-set leg-set-right"><path class="leg" d="M7 44 15 56 11 67" fill="none" stroke="#29353c" stroke-width="9" stroke-linecap="round"/><circle class="joint" cx="15" cy="56" r="4.5" fill="#29353c"/><path class="shoe" d="M6 68h13" stroke="#171d20" stroke-width="5"/></g><path d="M14 19q16 4 18 23v18" fill="none" stroke="#1d282e" stroke-width="3"/><g id="xuan-phone" transform="translate(15 27)"><rect width="8" height="14" rx="1.5" fill="#172127" stroke="#8cbec9"/><rect x="2" y="2" width="4" height="8" fill="#b9dce1"/></g><g id="cigarette-tips"><circle cx="28" cy="24" r="2" fill="#e67c4a"/></g><g id="smoke-curves" fill="none" stroke="#d1d3cc" stroke-width="2"><path d="M28 22c-8-9 8-12 0-21s7-12 1-20"/></g></g></g>
    <g id="fan" class="person fan" transform="translate(301 151)"><g class="breath"><circle class="phone-cold" cx="0" cy="5" r="25" fill="url(#phoneLight)"/><circle class="head" cx="0" cy="0" r="10" fill="#c78e6b"/><path d="M-9-3q8-11 18 0l-3-9-14-1Z" fill="#31383a"/><path class="torso" d="M-13 12Q0 5 13 12l5 35h-36Z" fill="#916448"/><path class="arm arm-left" d="M-10 16-15 29-20 38" fill="none" stroke="#916448" stroke-width="8" stroke-linecap="round"/><circle class="joint" cx="-15" cy="29" r="4" fill="#916448"/><path class="arm arm-right" d="M10 16 16 28 21 38" fill="none" stroke="#916448" stroke-width="8" stroke-linecap="round"/><circle class="joint" cx="16" cy="28" r="4" fill="#916448"/><g class="leg-set leg-set-left"><path class="leg" d="M-8 45-15 57-10 68" fill="none" stroke="#4c4643" stroke-width="9" stroke-linecap="round"/><circle class="joint" cx="-15" cy="57" r="4.5" fill="#4c4643"/><path class="shoe" d="M-15 69h12" stroke="#211e1d" stroke-width="5"/></g><g class="leg-set leg-set-right"><path class="leg" d="M8 45 16 57 11 68" fill="none" stroke="#4c4643" stroke-width="9" stroke-linecap="round"/><circle class="joint" cx="16" cy="57" r="4.5" fill="#4c4643"/><path class="shoe" d="M6 69h13" stroke="#211e1d" stroke-width="5"/></g><path d="M13 18q15 4 18 21v19" fill="none" stroke="#24282a" stroke-width="4"/><rect x="27" y="41" width="14" height="17" rx="2" fill="#252c30"/><g id="fan-phone" transform="translate(15 31)"><rect width="8" height="14" rx="1.5" fill="#172127" stroke="#8cbec9"/><rect class="phone-screen" x="2" y="2" width="4" height="8" fill="#b9dce1"/></g><circle class="fan-cig-tip" cx="9" cy="21" r="2" fill="#e67c4a"/><g id="fan-cigarette"><path d="M9 21l18-5" stroke="#e2d5b6" stroke-width="3"/><circle cx="27" cy="16" r="2" fill="#d36e43"/></g><path class="fan-smoke" d="M9 19c7-10-7-13 1-22s-4-13 3-19" fill="none" stroke="#d1d3cc" stroke-width="2"/></g></g>
    <circle id="xuan-face-light" cx="0" cy="0" r="10" fill="url(#phoneLight)"/><circle id="fan-face-light" cx="0" cy="0" r="10" fill="url(#phoneLight)"/>
    <g id="fan-lookback-face" transform="translate(344 151)"><path d="M-9-3q8-11 18 0l-3-9-14-1Z" fill="#31383a"/><path d="m-6 0-5 2 5 2" fill="#a66f55"/><circle cx="-4" cy="-2" r="1" fill="#272526"/></g>
    <path id="xuan-point-arm" d="M181 169q25-18 51-36" fill="none" stroke="#344551" stroke-width="8" stroke-linecap="round"/>
    <g id="charger-cable" transform="translate(188 189)" fill="none" stroke="#161b1e" stroke-width="2"><path pathLength="1" d="M0 0c22-11 29 20 7 19S-9 3 8 5s19 17 7 19"/><path pathLength="1" d="M16 24h8v5"/></g>
    <g id="cigarette-pack" transform="translate(291 177) rotate(-12)"><rect width="14" height="19" rx="2" fill="#d0c5a8"/><path d="M1 5h12" stroke="#a45e4c" stroke-width="4"/></g>
    <g id="shared-cigarettes" stroke="#e2d5b6" stroke-width="3" stroke-linecap="round"><path d="M194 177l12-2"/><path d="M302 174l12-2"/></g>
    <g id="lighter-sparks" fill="#e6b34e"><circle cx="286" cy="184" r="2"/><circle cx="291" cy="177" r="1.5"/><circle cx="296" cy="183" r="2"/></g><path id="lighter-flame" d="M291 185c-7-8 2-14 2-19 8 9 7 15-2 19Z" fill="#e99742"/>
    <g id="clothes-dust" fill="#b8b3a3"><circle cx="290" cy="210" r="2"/><circle cx="298" cy="215" r="1.5"/><circle cx="306" cy="207" r="1.6"/><circle cx="314" cy="217" r="1.4"/></g>
    <g id="street-bike" transform="translate(445 213)"><circle cx="-16" cy="20" r="13" fill="none" stroke="#172125" stroke-width="2"/><circle cx="18" cy="20" r="13" fill="none" stroke="#172125" stroke-width="2"/><path d="m-16 20 14-16 20 16H-16L1 20-2 4m0 0h13m7 16 8-24" fill="none" stroke="#6f867e" stroke-width="2.5"/><circle cx="5" cy="-14" r="6" fill="#b98262"/><path d="M4-8-2 4m6-12 13 8" stroke="#40565c" stroke-width="6" stroke-linecap="round"/><path d="M-2 4-9 15m7-11 14 13" stroke="#364348" stroke-width="5"/></g>
    <g id="empty-bottle" transform="translate(383 232) rotate(72)"><path d="M0 2h16v6H0z" fill="#849a93" stroke="#34484a"/><path d="M16 3h4v4h-4" fill="#a2aea8"/></g>
  </g>
</svg>`;

export function buildScene() {
  return SCENE;
}
