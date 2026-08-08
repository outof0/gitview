import { useEffect, useState } from "react";
import { useGitBlame } from "../useGitBlame";
import { useBlameStore } from "../../stores/blameStore";
import { useGitViewStore } from "../../stores/gitViewStore";
import type { MergeDocument } from "../../../../src/core/types";

export function useMergeBlame(activeDocument: MergeDocument | null) {
  const annotateOnOpen = useGitViewStore((s) => s.annotateOnOpen);
  const { requestBlame } = useGitBlame();
  const blameOurs = useBlameStore((s) => s.ours);
  const blameTheirs = useBlameStore((s) => s.theirs);
  const resetBlame = useBlameStore((s) => s.reset);

  const [showBlameLeft, setShowBlameLeft] = useState(false);
  const [showBlameRight, setShowBlameRight] = useState(false);

  const enableAnnotateBlame = (pane: "left" | "right") => {
    if (pane === "left") {
      setShowBlameLeft(true);
    } else {
      setShowBlameRight(true);
    }
  };

  const toggleAnnotateBlame = (pane: "left" | "right") => {
    if (pane === "left") {
      setShowBlameLeft((prev) => !prev);
    } else {
      setShowBlameRight((prev) => !prev);
    }
  };

  useEffect(() => {
    resetBlame();
    setShowBlameLeft(false);
    setShowBlameRight(false);
  }, [activeDocument?.relativePath, resetBlame]);

  useEffect(() => {
    if (!activeDocument || !annotateOnOpen) {
      return;
    }
    useGitViewStore.getState().setAnnotateOnOpen(null);
    enableAnnotateBlame(annotateOnOpen === "theirs" ? "right" : "left");
  }, [activeDocument, annotateOnOpen]);

  useEffect(() => {
    if (!activeDocument || !showBlameLeft) {
      return;
    }
    const cached = useBlameStore.getState().ours;
    if (
      cached.relativePath === activeDocument.relativePath &&
      cached.lines &&
      !cached.error
    ) {
      return;
    }
    requestBlame(activeDocument.relativePath, "ours");
  }, [showBlameLeft, activeDocument, requestBlame]);

  useEffect(() => {
    if (!activeDocument || !showBlameRight) {
      return;
    }
    const cached = useBlameStore.getState().theirs;
    if (
      cached.relativePath === activeDocument.relativePath &&
      cached.lines &&
      !cached.error
    ) {
      return;
    }
    requestBlame(activeDocument.relativePath, "theirs");
  }, [showBlameRight, activeDocument, requestBlame]);

  useEffect(() => {
    if (blameOurs.error) {
      useGitViewStore.getState().showToast(blameOurs.error, "error");
    }
  }, [blameOurs.error]);

  useEffect(() => {
    if (blameTheirs.error) {
      useGitViewStore.getState().showToast(blameTheirs.error, "error");
    }
  }, [blameTheirs.error]);

  return {
    showBlameLeft,
    showBlameRight,
    blameOurs,
    blameTheirs,
    enableAnnotateBlame,
    toggleAnnotateBlame,
  };
}