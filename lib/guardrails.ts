const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(\w+\s+){0,3}(instructions|rules|prompt|system)/i,
  /you\s+are\s+(now|a|an)\s+(?!spur['s]?\b)/i,
  /pretend\s+(you\s+are|to\s+be|that\s+you)/i,
  /act\s+as\s+(a|an|if|an?\s+unrestricted)\b/i,
  /roleplay\s+as/i,
  /jailbreak/i,
  /\bDAN\b/,
  /forget\s+(everything|all|your\s+training|your\s+instructions|and\s+just\s+chat)/i,
  /reveal\s+(your|the)\s+(system\s+prompt|instructions|rules)/i,
  /what\s+(are|is)\s+your\s+(system\s+prompt|instructions|rules|directives)/i,
  /no\s+restrictions/i,
];

const SPUR_KEYWORDS: RegExp[] = [
  /\bspur\b/i,
  /whatsapp/i,
  /instagram/i,
  /facebook/i,
  /chatbot/i,
  /automation/i,
  /shopify/i,
  /woocommerce/i,
  /broadcast/i,
  /bulk\s+message/i,
  /dm\s+automation/i,
  /meta\s+(tech|business|api)/i,
  /whatsapp\s+business/i,
  /abandoned\s+cart/i,
  /ecommerce/i,
  /razorpay/i,
  /stripe/i,
  /zoho/i,
  /leadsquared/i,
  /spurnow/i,
  /subscription\s+plan/i,
  /pricing\s+plan/i,
  /live\s+chat/i,
  /support\s+(ticket|team|plan)/i,
  /segment/i,
  /workflow/i,
  /integration/i,
];

const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(who\s+(directed|wrote|starred|invented|discovered|created|founded|won|is\s+the\s+hero))\b/i,
  /\b(capital\s+of|population\s+of|president\s+of|prime\s+minister\s+of)\b/i,
  /\b(movie|film|actor|actress|song|album|band|celebrity|sport|football|cricket|basketball|recipe|cook|bake)\b/i,
  /\b(write\s+(me\s+)?(a|an)\s+(poem|essay|story|python|javascript|java|bash|shell)\s*(script)?)\b/i,
  /\b(solve\s+(this|the)\s+(equation|problem|math))\b/i,
  /\bhow\s+do\s+i\s+(code|program|build|create)\s+(?!.*spur)/i,
  /\b(weather|temperature|forecast)\s+(in|for|at)\b/i,
  /\b(stock\s+price|cryptocurrency|bitcoin|ethereum)\b/i,
  /\btranslate\s+(this|the|to)\b/i,
  /\btell\s+me\s+a\s+joke\b/i,
  /\bwhat\s+is\s+\d+\s*[+\-*/]\s*\d+\b/i,
  /\bwho\s+is\s+the\s+hero\s+of\b/i,
];

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOffTopic(text: string): boolean {
  const hasSpurContext = SPUR_KEYWORDS.some((pattern) => pattern.test(text));
  if (hasSpurContext) return false;

  return OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(text));
}
