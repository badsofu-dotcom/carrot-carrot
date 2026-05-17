/**
 * MissionsSheet (Round 19, PR-136) — bottom sheet wrapper for the
 * Daily + Weekly mission cards.
 *
 * Round 18 (PR-132) moved the two mission cards out of HomePage onto
 * the farm view as inline cards. Round 19 (베타5 피드백) folds them
 * back behind a 🎯 button in the farm header so the farm plots get
 * their vertical real estate back.
 *
 * Inside the sheet, the cards are always expanded — the sheet itself
 * is the user's "I want to see missions" intent, so the per-card
 * collapse trigger would be a redundant tap.
 */

import { BottomSheet } from "../../design-system/ui";
import { DailyMissionsCard } from "./DailyMissionsCard";
import { WeeklyMissionsCard } from "./WeeklyMissionsCard";

interface MissionsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MissionsSheet({ open, onClose }: MissionsSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="🎯 오늘 / 이번 주 목표"
    >
      <div data-testid="missions-sheet-body">
        <DailyMissionsCard alwaysExpanded />
        <WeeklyMissionsCard alwaysExpanded />
      </div>
    </BottomSheet>
  );
}
