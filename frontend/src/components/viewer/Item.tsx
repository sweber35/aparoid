import { createMemo, For, Match, Switch } from "solid-js";
import { itemNamesById } from "~/common/ids";
import { ItemUpdate, PlayerUpdate } from "~/common/types";
import { replayStore } from "~/state/awsStore";
import { themeStore } from "~/state/themeStore";

// TODO: characters projectiles

// Note: Most items coordinates and sizes are divided by 256 to convert them
// from hitboxspace to worldspace.
export function Item(props: { item: ItemUpdate }) {
  const itemName = createMemo(() => itemNamesById[props.item.typeId]);
  
  // Debug logging for items that don't match any case
  const debugInfo = createMemo(() => {
    const name = itemName();
    const isSupported = name && [
      "Needle(thrown)",
      "Fox's Laser",
      "Falco's Laser", 
      "Turnip",
      "Yoshi's egg(thrown)",
      "Luigi's fire",
      "Mario's fire",
      "Missile",
      "Samus's bomb",
      "Samus's chargeshot",
      "Shyguy (Heiho)"
    ].includes(name);
    
    if (!isSupported) {
      console.warn(`Unsupported item type: ${props.item.typeId} -> "${name}"`, props.item);
    }
    
    return { name, isSupported };
  });
  
  return (
    <Switch>
      <Match when={debugInfo().name === "Needle(thrown)"}>
        <Needle item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Fox's Laser"}>
        <FoxLaser item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Falco's Laser"}>
        <FalcoLaser item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Turnip"}>
        <Turnip item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Yoshi's egg(thrown)"}>
        <YoshiEgg item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Luigi's fire"}>
        <LuigiFireball item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Mario's fire"}>
        <MarioFireball item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Missile"}>
        <Missile item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Samus's bomb"}>
        <SamusBomb item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Samus's chargeshot"}>
        <SamusChargeshot item={props.item} />
      </Match>
      <Match when={debugInfo().name === "Shyguy (Heiho)"}>
        <FlyGuy item={props.item} />
      </Match>
    </Switch>
  );
}

function SamusChargeshot(props: { item: ItemUpdate }) {
  // charge levels go 0 to 7
  const hitboxesByChargeLevel = [300, 400, 500, 600, 700, 800, 900, 1200];
  return (
    <>
      <circle
        cx={props.item.xPosition}
        cy={props.item.yPosition}
        r={hitboxesByChargeLevel[props.item.chargeShotChargeLevel] / 256}
        fill={themeStore.isDark() ? "#4A4A4A" : "darkgray"} // charred-graphite in dark mode
      />
    </>
  );
}

function SamusBomb(props: { item: ItemUpdate }) {
  // states: 1 = falling, 3 = exploding
  return (
    <>
      <circle
        cx={props.item.xPosition}
        cy={props.item.yPosition}
        r={(props.item.state === 3 ? 1536 : 500) / 256}
        fill="darkgray"
      />
    </>
  );
}

function Missile(props: { item: ItemUpdate }) {
  // samusMissileTypes: 0 = homing missile, 1 = smash missile
  return (
    <>
      <circle
        cx={props.item.xPosition}
        cy={props.item.yPosition}
        r={(props.item.samusMissileType === 0 ? 500 : 600) / 256}
        fill="darkgray"
      />
    </>
  );
}

function MarioFireball(props: { item: ItemUpdate }) {
  return (
    <>
      <circle
        cx={props.item.xPosition}
        cy={props.item.yPosition}
        r={600 / 256}
        fill="darkgray"
      />
    </>
  );
}

function LuigiFireball(props: { item: ItemUpdate }) {
  return (
    <>
      <circle
        cx={props.item.xPosition}
        cy={props.item.yPosition}
        r={500 / 256}
        fill="darkgray"
      />
    </>
  );
}

function YoshiEgg(props: { item: ItemUpdate }) {
  // states: 0 = held, 1 = thrown, 2 = exploded
  const ownerState = createMemo(() => getOwner(replayStore, props.item).state);
  return (
    <>
      <circle
        cx={
          props.item.state === 0 ? ownerState().xPosition : props.item.xPosition
        }
        cy={
          props.item.state === 0
            ? ownerState().yPosition + 8
            : props.item.yPosition
        }
        r={props.item.state === 2 ? 2500 / 256 : 1000 / 256}
        fill="darkgray"
        opacity={props.item.state === 1 ? 1 : 0.5}
      />
    </>
  );
}

function Turnip(props: { item: ItemUpdate }) {
  // states: 0 = held, 1 = bouncing?, 2 = thrown
  // face: props.item.peachTurnipFace
  const ownerState = createMemo(() => getOwner(replayStore, props.item).state);
  return (
    <>
      <circle
        cx={
          props.item.state === 0 ? ownerState().xPosition : props.item.xPosition
        }
        cy={
          props.item.state === 0
            ? ownerState().yPosition + 8
            : props.item.yPosition
        }
        r={600 / 256}
        fill="darkgray"
        opacity={props.item.state === 0 ? 0.5 : 1}
      />
    </>
  );
}

function Needle(props: { item: ItemUpdate }) {
  return (
    <>
      <circle
        cx={props.item.xPosition}
        cy={props.item.yPosition}
        r={500 / 256}
        fill="darkgray"
      />
    </>
  );
}

function FoxLaser(props: { item: ItemUpdate }) {
  const hitboxOffsets = [-200, -933, -1666, -2400].map((x) => x / 256);
  const hitboxSize = 300 / 256;
  
  const laserColor = () => themeStore.isDark() ? "#D000FF" : "red"; // venom-magenta in dark mode
  
  // Throws and deflected lasers are not straight horizontal
  const rotations = createMemo(() => {
    const direction = Math.atan2(props.item.yVelocity, props.item.xVelocity);
    return [Math.cos(direction), Math.sin(direction)];
  });
  return (
    <>
      <line
        x1={props.item.xPosition + hitboxOffsets[0] * rotations()[0]}
        y1={props.item.yPosition + hitboxOffsets[0] * rotations()[1]}
        x2={
          props.item.xPosition +
          hitboxOffsets[hitboxOffsets.length - 1] *
            props.item.facingDirection *
            rotations()[0]
        }
        y2={
          props.item.yPosition +
          hitboxOffsets[hitboxOffsets.length - 1] *
            props.item.facingDirection *
            rotations()[1]
        }
        stroke={laserColor()}
      />
      <For each={hitboxOffsets}>
        {(hitboxOffset) => (
          <circle
            cx={
              props.item.xPosition +
              hitboxOffset * props.item.facingDirection * rotations()[0]
            }
            cy={
              props.item.yPosition +
              hitboxOffset * props.item.facingDirection * rotations()[1]
            }
            r={hitboxSize}
            fill={laserColor()}
          />
        )}
      </For>
    </>
  );
}

function FalcoLaser(props: { item: ItemUpdate }) {
  const hitboxOffsets = [-200, -933, -1666, -2400].map((x) => x / 256);
  const hitboxSize = 300 / 256;
  
  const laserColor = () => themeStore.isDark() ? "#D000FF" : "red"; // venom-magenta in dark mode
  
  // Throws and deflected lasers are not straight horizontal
  const rotations = createMemo(() => {
    const direction = Math.atan2(props.item.yVelocity, props.item.xVelocity);
    return [Math.cos(direction), Math.sin(direction)];
  });
  return (
    <>
      <line
        x1={props.item.xPosition + hitboxOffsets[0] * rotations()[0]}
        y1={props.item.yPosition + hitboxOffsets[0] * rotations()[1]}
        x2={
          props.item.xPosition +
          hitboxOffsets[hitboxOffsets.length - 1] * rotations()[0]
        }
        y2={
          props.item.yPosition +
          hitboxOffsets[hitboxOffsets.length - 1] * rotations()[1]
        }
        stroke={laserColor()}
      />
      <For each={hitboxOffsets}>
        {(hitboxOffset) => (
          <circle
            cx={ props.item.xPosition + hitboxOffset * rotations()[0]}
            cy={ props.item.yPosition + hitboxOffset * rotations()[1]}
            r={hitboxSize}
            fill={laserColor()}
          />
        )}
      </For>
    </>
  );
}

function FlyGuy(props: { item: ItemUpdate }) {
  return (
    <>
      <circle
        cx={props.item.xPosition}
        cy={props.item.yPosition}
        r={5 * 0.85}
        fill="#aa0000"
      />
    </>
  );
}

function getOwner(replayStore: any, item: ItemUpdate): PlayerUpdate {
  return replayStore.replayData!.frames[item.frameNumber].players[item.owner];
}
