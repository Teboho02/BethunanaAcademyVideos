import type { Response } from 'superagent';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';

const describeIf = process.env.RUN_BACKEND_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

interface StudentApiResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    surname: string;
    studentNumber: string;
    grade: 10 | 11 | 12;
    status: 'active' | 'deactivated';
    createdAt: string;
    updatedAt: string;
  };
  message?: string;
}

interface StudentsListResponse {
  success: boolean;
  data: Array<{
    id: string;
    name: string;
    surname: string;
    studentNumber: string;
    grade: 10 | 11 | 12;
    status: 'active' | 'deactivated';
    createdAt: string;
    updatedAt: string;
  }>;
}

interface VideoUploadResponse {
  success: boolean;
  data: {
    id: string;
    title: string;
    storageType: 'local' | 's3';
    sizeBytes: number;
  };
}

interface CatalogResponse {
  success: boolean;
  data: {
    grades: number[];
    subjects: Array<{ id: string }>;
    topics: Array<{ id: string }>;
    videos: Array<{ id: string; playerType: 'embed' | 'stream' }>;
  };
}

const binaryParser = (
  res: Response,
  callback: (error: Error | null, body: Buffer) => void
): void => {
  res.setEncoding('binary');
  let data = '';

  res.on('data', (chunk: string) => {
    data += chunk;
  });

  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
};

describeIf('API health', () => {
  it('returns healthy status', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(typeof response.body.data.timestamp).toBe('string');
  });
});

describeIf('Student management API', () => {
  it('supports enroll, list, deactivate and delete lifecycle', async () => {
    const enrollResponse = await request(app)
      .post('/api/admin/students/enroll')
      .send({
        name: 'Naledi',
        surname: 'Khumalo',
        grade: 10
      })
      .expect(201);

    const enrolled = enrollResponse.body as StudentApiResponse;
    expect(enrolled.success).toBe(true);
    expect(enrolled.data.name).toBe('Naledi');
    expect(enrolled.data.surname).toBe('Khumalo');
    expect(enrolled.data.studentNumber).toMatch(/^BNA\d{9}$/);
    expect(enrolled.data.grade).toBe(10);
    expect(enrolled.data.status).toBe('active');

    const listAfterCreate = await request(app)
      .get('/api/admin/students')
      .expect(200);

    const createdStudent = (listAfterCreate.body as StudentsListResponse).data.find(
      (student) => student.id === enrolled.data.id
    );
    expect(createdStudent).toBeDefined();
    expect(createdStudent?.studentNumber).toBe(enrolled.data.studentNumber);

    const deactivateResponse = await request(app)
      .patch(`/api/admin/students/${enrolled.data.id}/deactivate`)
      .expect(200);

    const deactivated = deactivateResponse.body as StudentApiResponse;
    expect(deactivated.success).toBe(true);
    expect(deactivated.data.status).toBe('deactivated');

    await request(app)
      .delete(`/api/admin/students/${enrolled.data.id}`)
      .expect(200);

    const listAfterDelete = await request(app)
      .get('/api/admin/students')
      .expect(200);

    const deletedStudent = (listAfterDelete.body as StudentsListResponse).data.find(
      (student) => student.id === enrolled.data.id
    );
    expect(deletedStudent).toBeUndefined();
  });

  it('validates enrollment payload', async () => {
    const response = await request(app)
      .post('/api/admin/students/enroll')
      .send({
        name: 'OnlyName',
        grade: 10
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('surname');
  });

  it('accepts grade 11 enrollments', async () => {
    const response = await request(app)
      .post('/api/admin/students/enroll')
      .send({
        name: 'Palesa',
        surname: 'Dlamini',
        grade: 11
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.grade).toBe(11);
  });
});

describeIf('Video upload and streaming API', () => {
  it('uploads a video and streams requested byte range', async () => {
    const sourceBuffer = Buffer.from('0123456789abcdefghij', 'utf8');
    const createTopicResponse = await request(app)
      .post('/api/admin/topics')
      .send({
        subjectId: 'g12-mathematics',
        name: 'Integration Test Topic A'
      })
      .expect(201);
    const topicId = createTopicResponse.body.data.id as string;

    const uploadResponse = await request(app)
      .post('/api/videos/upload')
      .field('title', 'Grade 12 Algebra - Intro')
      .field('description', 'Test upload')
      .field('subjectId', 'g12-mathematics')
      .field('topicId', topicId)
      .attach('video', sourceBuffer, {
        filename: 'intro.mp4',
        contentType: 'video/mp4'
      })
      .expect(201);

    const uploaded = uploadResponse.body as VideoUploadResponse;
    expect(uploaded.success).toBe(true);
    expect(uploaded.data.id).toBeTruthy();
    expect(uploaded.data.storageType).toBe('local');
    expect(uploaded.data.sizeBytes).toBe(sourceBuffer.length);

    const listResponse = await request(app)
      .get('/api/videos')
      .expect(200);

    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data.length).toBe(1);
    expect(listResponse.body.data[0].id).toBe(uploaded.data.id);

    const catalogResponse = await request(app)
      .get('/api/content/catalog')
      .expect(200);

    const catalogPayload = catalogResponse.body as CatalogResponse;
    expect(catalogPayload.success).toBe(true);
    expect(catalogPayload.data.subjects.length).toBeGreaterThan(0);
    expect(catalogPayload.data.videos.some((video) => video.id === uploaded.data.id)).toBe(true);
    const uploadedCatalogVideo = catalogPayload.data.videos.find((video) => video.id === uploaded.data.id);
    expect(uploadedCatalogVideo?.playerType).toBe('stream');

    const streamResponse = await request(app)
      .get(`/api/videos/${uploaded.data.id}/stream`)
      .set('Range', 'bytes=0-4')
      .buffer(true)
      .parse(binaryParser)
      .expect(206);

    expect(streamResponse.headers['accept-ranges']).toBe('bytes');
    expect(streamResponse.headers['content-range']).toContain('bytes 0-4/');
    expect(streamResponse.headers['content-length']).toBe('5');
    expect(Buffer.isBuffer(streamResponse.body)).toBe(true);
    expect((streamResponse.body as Buffer).toString('utf8')).toBe('01234');

    await request(app)
      .delete(`/api/videos/${uploaded.data.id}`)
      .expect(200);

    const listAfterDelete = await request(app)
      .get('/api/videos')
      .expect(200);

    expect(listAfterDelete.body.success).toBe(true);
    expect(listAfterDelete.body.data.some((video: { id: string }) => video.id === uploaded.data.id)).toBe(false);
  });

  it('returns 416 for invalid range', async () => {
    const sourceBuffer = Buffer.from('abcdefghijklmnop', 'utf8');
    const createTopicResponse = await request(app)
      .post('/api/admin/topics')
      .send({
        subjectId: 'g12-mathematics',
        name: 'Integration Test Topic B'
      })
      .expect(201);
    const topicId = createTopicResponse.body.data.id as string;

    const uploadResponse = await request(app)
      .post('/api/videos/upload')
      .field('title', 'Range validation video')
      .field('subjectId', 'g12-mathematics')
      .field('topicId', topicId)
      .attach('video', sourceBuffer, {
        filename: 'range.mp4',
        contentType: 'video/mp4'
      })
      .expect(201);

    const videoId = (uploadResponse.body as VideoUploadResponse).data.id;

    const response = await request(app)
      .get(`/api/videos/${videoId}/stream`)
      .set('Range', 'bytes=999-1000')
      .expect(416);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Invalid range');
  });
});
