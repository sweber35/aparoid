import { createMemo } from "solid-js";
import { stageNameByExternalId } from "~/common/ids";

export function PlayerBadge(props: { port: number }) {
  return (
    <span
      class="inline-flex w-max items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      // classList={{
      //   "bg-red-100 text-red-800": props.port === 1,
      //   "bg-blue-100 text-blue-800": props.port === 2,
      //   "bg-yellow-100 text-yellow-800": props.port === 3,
      //   "bg-green-100 text-green-800": props.port === 4,
      // }}
    >
      P{props.port}
    </span>
  );
}

export function StageBadge(props: { stageId: number }) {
  
  const abbreviation = createMemo(() => {
    return (
      { 8: "YS", 3: "PS", 2: "FoD", 31: "BF", 32: "FD", 28: "DL" }[
        props.stageId
      ] ?? "??"
    );
  });
  
  // Debug: check which color condition matches
  const colorClass = props.stageId == 8 ? "bg-red-100 text-red-800" :
                    props.stageId == 2 ? "bg-purple-100 text-purple-800" :
                    props.stageId == 3 ? "bg-green-100 text-green-800" :
                    props.stageId == 31 ? "bg-blue-100 text-blue-800" :
                    props.stageId == 32 ? "bg-fuchsia-100 text-fuchsia-800" :
                    props.stageId == 28 ? "bg-orange-100 text-orange-800" :
                    "bg-gray-100 text-gray-800"; // default
    
  return (
    <span
      class={`inline-flex w-max items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      title={stageNameByExternalId[props.stageId]}
    >
      {abbreviation()}
    </span>
  );
}
