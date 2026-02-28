import { useEffect, useRef, useState } from 'react';
import { Plus, Upload, FileVideo, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Progress } from '../../components/ui/progress';
import { useCatalog } from '../../hooks/useCatalog';
import { invalidateCatalogCache } from '../../services/contentCatalog';

interface VideoFormData {
  grade: number;
  subjectId: string;
  topicId: string;
  title: string;
  description: string;
  videoFile: File | null;
}

const generateThumbnailFromVideo = (videoFile: File): Promise<File> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    const rejectOnce = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const resolveOnce = (file: File) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };

    const captureFrame = () => {
      const sourceWidth = video.videoWidth || 1280;
      const sourceHeight = video.videoHeight || 720;

      if (sourceWidth <= 0 || sourceHeight <= 0) {
        rejectOnce('Unable to determine video dimensions for thumbnail generation.');
        return;
      }

      const maxWidth = 1280;
      const scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
      canvas.width = Math.max(1, Math.floor(sourceWidth * scale));
      canvas.height = Math.max(1, Math.floor(sourceHeight * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rejectOnce('Unable to create image context for thumbnail generation.');
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            rejectOnce('Failed to encode thumbnail image.');
            return;
          }

          const baseName = videoFile.name.replace(/\.[^.]+$/, '');
          const thumbnail = new File([blob], `${baseName}-thumbnail.jpg`, {
            type: 'image/jpeg'
          });
          resolveOnce(thumbnail);
        },
        'image/jpeg',
        0.82
      );
    };

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onerror = () => rejectOnce('Unable to load video for thumbnail generation.');
    video.onloadedmetadata = () => {
      const hasDuration = Number.isFinite(video.duration) && video.duration > 0;
      if (!hasDuration) {
        captureFrame();
        return;
      }

      const captureTime = Math.min(Math.max(video.duration * 0.1, 0.1), 5);
      video.currentTime = captureTime;
    };
    video.onseeked = () => captureFrame();
    video.src = objectUrl;
  });

const parseUploadErrorMessage = (status: number, responseText: string): string => {
  try {
    const payload = JSON.parse(responseText) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Upload failed (${status})`;
  } catch {
    return `Upload failed (${status})`;
  }
};

const uploadVideoWithProgress = (
  body: FormData,
  onProgress: (progress: number) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload');
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        return;
      }
      const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(progress);
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed (network error)'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload cancelled'));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(parseUploadErrorMessage(xhr.status, xhr.responseText)));
    };

    xhr.send(body);
  });

export function UploadLesson() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailTaskIdRef = useRef(0);
  const { catalog, loading, error: catalogError, refetch } = useCatalog();
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');
  const [thumbnailGenerating, setThumbnailGenerating] = useState(false);
  const [thumbnailError, setThumbnailError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState<VideoFormData>({
    grade: 10,
    subjectId: '',
    topicId: '',
    title: '',
    description: '',
    videoFile: null
  });

  const grades = catalog?.grades ?? [10];
  const resolvedGrade = grades.includes(formData.grade) ? formData.grade : grades[0];
  const subjects = (catalog?.subjects ?? []).filter((subject) => subject.grade === resolvedGrade);
  const topics = formData.subjectId
    ? (catalog?.topics ?? []).filter((topic) => topic.subjectId === formData.subjectId)
    : [];

  const handleGradeChange = (grade: number) => {
    setFormData((prev) => ({ ...prev, grade, subjectId: '', topicId: '' }));
    setSubmitError('');
    setSuccessMessage('');
  };

  const handleSubjectChange = (subjectId: string) => {
    setFormData((prev) => ({ ...prev, subjectId, topicId: '' }));
    setSubmitError('');
    setSuccessMessage('');
  };

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
    };
  }, [thumbnailPreviewUrl]);

  const resetThumbnailPreview = () => {
    setThumbnailPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return '';
    });
  };

  const setThumbnailWithPreview = (file: File | null) => {
    setThumbnailFile(file);
    setThumbnailPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return file ? URL.createObjectURL(file) : '';
    });
  };

  const handleVideoFileChange = async (file: File | null) => {
    const taskId = ++thumbnailTaskIdRef.current;
    setFormData((prev) => ({ ...prev, videoFile: file }));
    setSubmitError('');
    setSuccessMessage('');
    setThumbnailError('');
    setThumbnailGenerating(false);
    setThumbnailWithPreview(null);

    if (!file) {
      return;
    }

    setThumbnailGenerating(true);

    try {
      const generatedThumbnail = await generateThumbnailFromVideo(file);
      if (taskId !== thumbnailTaskIdRef.current) {
        return;
      }
      setThumbnailWithPreview(generatedThumbnail);
    } catch (error) {
      if (taskId !== thumbnailTaskIdRef.current) {
        return;
      }
      setThumbnailError(
        error instanceof Error
          ? error.message
          : 'Unable to generate thumbnail from video. A fallback image will be used.'
      );
    } finally {
      if (taskId === thumbnailTaskIdRef.current) {
        setThumbnailGenerating(false);
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    if (!formData.videoFile) {
      setSubmitError('Please select a video file.');
      return;
    }

    if (!formData.subjectId || !formData.topicId) {
      setSubmitError('Please select both subject and topic.');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    try {
      const body = new FormData();
      body.append('video', formData.videoFile);
      body.append('title', formData.title.trim());
      body.append('description', formData.description.trim());
      body.append('subjectId', formData.subjectId);
      body.append('topicId', formData.topicId);
      if (thumbnailFile) {
        body.append('thumbnail', thumbnailFile);
      }

      await uploadVideoWithProgress(body, setUploadProgress);

      const uploadedSize = (formData.videoFile.size / (1024 * 1024)).toFixed(2);
      setSuccessMessage(`Video uploaded successfully (${uploadedSize} MB).`);
      setFormData({
        grade: resolvedGrade,
        subjectId: '',
        topicId: '',
        title: '',
        description: '',
        videoFile: null
      });
      setThumbnailFile(null);
      setThumbnailError('');
      resetThumbnailPreview();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      invalidateCatalogCache();
      await refetch();
    } catch (submitErr) {
      const message = submitErr instanceof Error ? submitErr.message : 'Failed to upload video';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Upload Lesson</h1>
        <p className="text-muted-foreground mt-1">Add a new educational video to the platform</p>
      </div>

      {loading && <p className="mb-4 text-sm text-muted-foreground">Loading catalog...</p>}

      {catalogError && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load content: {catalogError}
        </p>
      )}

      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              New Lesson
            </CardTitle>
            <CardDescription>Fill in the details below to upload a new video lesson</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Select value={String(resolvedGrade)} onValueChange={(value) => handleGradeChange(Number(value))}>
                    <SelectTrigger id="grade">
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map((grade) => (
                        <SelectItem key={grade} value={String(grade)}>
                          Grade {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select value={formData.subjectId} onValueChange={handleSubjectChange}>
                    <SelectTrigger id="subject">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Select
                  value={formData.topicId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, topicId: value }))}
                  disabled={!formData.subjectId}
                >
                  <SelectTrigger id="topic">
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Video Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Introduction to Quadratic Equations"
                  value={formData.title}
                  onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide a brief description of the lesson content..."
                  rows={3}
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, description: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Video File</Label>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-secondary/50 hover:bg-secondary/5 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleVideoFileChange(file);
                    }}
                    required
                  />
                  <div className="flex flex-col items-center gap-2">
                    {formData.videoFile ? (
                      <>
                        <FileVideo className="h-10 w-10 text-secondary" />
                        <p className="text-sm font-medium">{formData.videoFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(formData.videoFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">MP4, MOV, AVI, MKV, WebM</p>
                      </>
                    )}
                  </div>
                </div>

                {(thumbnailGenerating || thumbnailPreviewUrl || thumbnailError) && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3 text-left">
                    <p className="text-xs font-medium text-muted-foreground">Generated Thumbnail</p>
                    {thumbnailGenerating && (
                      <p className="mt-2 text-xs text-muted-foreground">Generating thumbnail from video...</p>
                    )}
                    {!thumbnailGenerating && thumbnailPreviewUrl && (
                      <img
                        src={thumbnailPreviewUrl}
                        alt="Generated video thumbnail"
                        className="mt-2 aspect-video w-full max-w-sm rounded-md border object-cover"
                      />
                    )}
                    {!thumbnailGenerating && thumbnailError && (
                      <p className="mt-2 text-xs text-destructive">{thumbnailError}</p>
                    )}
                  </div>
                )}
              </div>

              {submitting && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Uploading lesson...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {submitError && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{submitError}</p>
              )}

              {successMessage && (
                <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {successMessage}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting || loading || thumbnailGenerating}
              >
                <Upload className="mr-2 h-4 w-4" />
                {thumbnailGenerating ? 'Generating Thumbnail...' : submitting ? 'Uploading...' : 'Upload Video'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
