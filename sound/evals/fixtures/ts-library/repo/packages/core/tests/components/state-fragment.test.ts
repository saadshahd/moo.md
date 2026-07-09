import { describe, it, expect } from "vitest";
import { jsx } from "../../jsx-runtime/index.js";
import { GraphBuilder } from "../../core/builder.js";
import { StateFragment } from "../../components/StateFragment.js";

describe("StateFragment", () => {
  describe("component creation", () => {
    it("should create StateFragment with required props", () => {
      const fragment = StateFragment({
        entry: "start",
        exit: "end",
        children: [jsx("State", { name: "middle" })],
      });

      expect(fragment.type).toBe("StateFragment");
      expect(fragment.props.entry).toBe("start");
      expect(fragment.props.exit).toEqual(["end"]);
      expect(fragment.children).toHaveLength(1);
    });

    it("should normalize single exit to array", () => {
      const fragment = StateFragment({
        entry: "start",
        exit: "end",
      });

      expect(fragment.props.exit).toEqual(["end"]);
    });

    it("should preserve multiple exits as array", () => {
      const fragment = StateFragment({
        entry: "start",
        exit: ["success", "failure"],
      });

      expect(fragment.props.exit).toEqual(["success", "failure"]);
    });

    it("should handle namespace and fragmentProps", () => {
      const fragment = StateFragment({
        entry: "start",
        exit: "end",
        namespace: "test",
        fragmentProps: { theme: "dark" },
      });

      expect(fragment.props.namespace).toBe("test");
      expect(fragment.props.fragmentProps).toEqual({ theme: "dark" });
    });
  });

  describe("graph building and composition", () => {
    it("should build simple fragment into graph", () => {
      const simpleModel = jsx("TestModel", {
        name: "fragment-test",
        children: [
          jsx("StateFragment", {
            entry: "frag-start",
            exit: "frag-end",
            children: [
              jsx("InitialState", {
                name: "frag-start",
                children: [
                  jsx("OnEvent", {
                    name: "proceed",
                    children: [jsx("Transition", { to: "frag-end" })],
                  }),
                ],
              }),
              jsx("State", { name: "frag-end" }),
            ],
          }),
        ],
      });

      const graph = GraphBuilder.fromJSX(simpleModel);

      // Should have both states from fragment
      expect(graph.getAllStates()).toContain("frag-start");
      expect(graph.getAllStates()).toContain("frag-end");

      // Should have the transition
      const transitions = graph.getAllTransitions();
      const proceedTransition = transitions.find((t) => t.event === "proceed");
      expect(proceedTransition).toBeDefined();
      expect(proceedTransition?.from).toBe("frag-start");
      expect(proceedTransition?.to).toBe("frag-end");
    });

    it("should apply namespace to fragment states", () => {
      const namespacedModel = jsx("TestModel", {
        name: "namespaced-fragment-test",
        children: [
          jsx("StateFragment", {
            entry: "start",
            exit: "end",
            namespace: "auth",
            children: [
              jsx("InitialState", { name: "start" }),
              jsx("State", { name: "end" }),
            ],
          }),
        ],
      });

      const graph = GraphBuilder.fromJSX(namespacedModel);

      // States should be namespaced
      expect(graph.getAllStates()).toContain("auth:start");
      expect(graph.getAllStates()).toContain("auth:end");
      expect(graph.getAllStates()).not.toContain("start");
      expect(graph.getAllStates()).not.toContain("end");
    });

    it("should compose fragment with surrounding states", () => {
      const composedModel = jsx("TestModel", {
        name: "composed-fragment-test",
        children: [
          jsx("InitialState", {
            name: "before",
            children: [
              jsx("OnEvent", {
                name: "enter-fragment",
                children: [jsx("Transition", { to: "fragment-start" })],
              }),
            ],
          }),
          jsx("StateFragment", {
            entry: "fragment-start",
            exit: "fragment-end",
            children: [
              jsx("State", {
                name: "fragment-start",
                children: [
                  jsx("OnEvent", {
                    name: "fragment-proceed",
                    children: [jsx("Transition", { to: "fragment-end" })],
                  }),
                ],
              }),
              jsx("State", { name: "fragment-end" }),
            ],
          }),
          jsx("State", {
            name: "after",
            children: [
              jsx("OnEvent", {
                name: "continue",
                children: [jsx("Transition", { to: "final" })],
              }),
// [trimmed]
