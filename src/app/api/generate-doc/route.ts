import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { className, groupNumber, projectTitle, teamMembers } = await request.json();

        if (!className || !groupNumber || !projectTitle) {
            return NextResponse.json(
                { error: 'Missing required fields: className, groupNumber, projectTitle' },
                { status: 400 }
            );
        }

        const membersString = Array.isArray(teamMembers) && teamMembers.length > 0
            ? teamMembers.map((m: { full_name: string }) => m.full_name).join(', ')
            : 'N/A';

        const scriptUrl = process.env.GOOGLE_APPSCRIPT_URL;
        
        if (!scriptUrl) {
            console.error('Missing GOOGLE_APPSCRIPT_URL in .env.local');
            return NextResponse.json(
                { error: 'Server configuration error: Document generator is not linked. Please provide GOOGLE_APPSCRIPT_URL.' },
                { status: 500 }
            );
        }

        console.log(`[generate-doc] Calling Apps Script webhook...`);
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({
                className,
                groupNumber,
                projectTitle,
                teamMembers: membersString
            }),
            redirect: 'follow'
        });

        const result = await response.json();

        if (result.error) {
            console.error('[generate-doc] Apps script returned error:', result.error);
            throw new Error(result.error);
        }

        console.log(`[generate-doc] Successfully generated doc:`, result.docName);
        return NextResponse.json({
            success: true,
            docUrl: result.docUrl,
            docId: result.docId,
            docName: result.docName,
        });

    } catch (error: any) {
        console.error('[generate-doc] Failed to run Apps Script step:', error);
        return NextResponse.json(
            { 
                error: error.message || 'Failed to delegate document generation to Apps Script.',
                failedStep: 'appscript_webhook'
            },
            { status: 500 }
        );
    }
}
