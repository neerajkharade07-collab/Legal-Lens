import {
  Gauge,
  MessageSquareText,
  Activity,
  ListPlus,
  ShieldCheck,
  Quote,
  Search,
} from 'lucide-react';

/** Icon for each Legal Intelligence tool (keys match data/intelligenceTools.js `icon`). */
export const TOOL_ICONS = {
  overview: Gauge,
  health: Activity,
  clauses: ListPlus,
  compliance: ShieldCheck,
  citations: Quote,
  research: Search,
  assistant: MessageSquareText,
};
