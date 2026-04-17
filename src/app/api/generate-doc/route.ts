import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const TEMPLATE_DOC_ID = '1A8c7jl0mgwDDpZKNA6Af169eBYX7Zm5LK29Esc23BbY';
const TARGET_FOLDER_ID = '1szME7BfDsdm28ukYXFIDB0KjiujiD6E6';

async function getAuthClient() {
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
    }

    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/documents',
        ],
    });

    return auth;
}

export async function POST(request: Request) {
    try {
        const { className, groupNumber, projectTitle, teamMembers } = await request.json();

        if (!className || !groupNumber || !projectTitle) {
            return NextResponse.json(
                { error: 'Missing required fields: className, groupNumber, projectTitle' },
                { status: 400 }
            );
        }

        // Parse grade and class number from className (e.g., '10.3' -> grade=10, classNum=3)
        const parts = className.split('.');
        const gradeLevel = parts[0];
        const classNumber = parts[1] || '1';

        const docName = `Grade ${gradeLevel}_Class ${classNumber}_Group ${groupNumber}`;

        // Build group members string
        const membersString = Array.isArray(teamMembers) && teamMembers.length > 0
            ? teamMembers.map((m: { full_name: string }) => m.full_name).join(', ')
            : 'N/A';

        // Authenticate
        const auth = await getAuthClient();
        const drive = google.drive({ version: 'v3', auth });
        const docs = google.docs({ version: 'v1', auth });

        // Step 1: Copy the template document into the target folder
        const copyResponse = await drive.files.copy({
            fileId: TEMPLATE_DOC_ID,
            requestBody: {
                name: docName,
                parents: [TARGET_FOLDER_ID],
            },
        });

        const newDocId = copyResponse.data.id;
        if (!newDocId) {
            throw new Error('Failed to copy template document');
        }

        // Step 2: Replace placeholders in the new document
        await docs.documents.batchUpdate({
            documentId: newDocId,
            requestBody: {
                requests: [
                    {
                        replaceAllText: {
                            containsText: { text: '<project_title>', matchCase: false },
                            replaceText: projectTitle,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '<group_members>', matchCase: false },
                            replaceText: membersString,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '<student_class>', matchCase: false },
                            replaceText: className,
                        },
                    },
                ],
            },
        });

        // Step 3: Set the document to "Anyone with the link can view"
        await drive.permissions.create({
            fileId: newDocId,
            requestBody: {
                type: 'anyone',
                role: 'writer',
            },
        });

        const docUrl = `https://docs.google.com/document/d/${newDocId}/edit`;

        return NextResponse.json({
            success: true,
            docUrl,
            docId: newDocId,
            docName,
        });
    } catch (error: any) {
        console.error('Generate doc error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to generate document',
                details: error.errors || null,
            },
            { status: 500 }
        );
    }
}
