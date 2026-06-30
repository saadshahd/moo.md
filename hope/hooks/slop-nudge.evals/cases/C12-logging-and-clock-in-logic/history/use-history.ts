import { useCallback } from "react";
import type { ActorRef } from "xstate";
import { classifyPushResult } from "./push-result.js";
import type { Data } from "@puckeditor/core";

type PushResult = { kind: "pushed" } | { kind: "noop" };

export const useHistory = (actorRef: ActorRef) => {
  const push = useCallback(
    (data: Data): PushResult => {
      const before = actorRef.getSnapshot().context;
      actorRef.send({ type: "PUSH", data, timestamp: Date.now() });
      const after = actorRef.getSnapshot().context;
      const heroHeading = after.entries[after.currentIndex]?.data?.content?.find?.(
        (z: { props?: { id?: string } }) => z.props?.id === "hero-heading",
      );
      console.log(
        "[push] after send, currentIndex:",
        after.currentIndex,
        "entries:",
        after.entries.length,
        "hero fontSize:",
        heroHeading?.props?.style?.fontSize,
      );
      return classifyPushResult({ before, after });
    },
    [actorRef],
  );

  return { push };
};
