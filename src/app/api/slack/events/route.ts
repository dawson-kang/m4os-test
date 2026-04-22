import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest } from '@/lib/slack/verify';
import { processReactionAdded, processMessageDeleted } from '@/lib/slack/processor';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  // 1. 보안 검증
  if (!await verifySlackRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  // 2. Slack Challenge 처리
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  // 3. 실시간 이벤트 처리
  if (body.type === 'event_callback') {
    const event = body.event;

    // 이모지 반응 추가
    if (event.type === 'reaction_added') {
      await processReactionAdded(event);
    }
    
    // 이모지 반응 삭제 (안전한 처리를 위해 무시하거나 상태 변경 가능)
    // 현재는 'm4삭제' 이모지로 제어하므로 reaction_removed는 선택적 구현

    // 메시지 삭제 감지
    if (event.type === 'message' && event.subtype === 'message_deleted') {
      await processMessageDeleted(event);
    }
  }

  return NextResponse.json({ ok: true });
}
