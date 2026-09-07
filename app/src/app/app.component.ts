import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateInterface } from './types/date';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnDestroy {

  // ----------------------------------------
  // Estado da aplicação
  // ----------------------------------------

  cameraCount = 128;
  occurrenceCount = 3;
  currentTime = '';

  selectedFile: File | null = null;
  videoPreviewUrl: string | null = null;
  frameDataUrl: string | null = null;

  isAnalyzing = false;
  detected = false;
  hasResult = false;
  videoError = false;

  private clockInterval?: ReturnType<typeof setInterval>;

  readonly maxChartValue = 12;

  readonly chartData: DateInterface[] = [
    { day: 'Ter', value: 4 },
    { day: 'Qua', value: 6 },
    { day: 'Qui', value: 3 },
    { day: 'Sex', value: 7 },
    { day: 'Sáb', value: 9 },
    { day: 'Dom', value: 5 },
    { day: 'Seg', value: 4, highlight: true }
  ];

  constructor() {
    this.updateClock();

    this.clockInterval = setInterval(() => {
      this.updateClock();
    }, 30000);
  }

  private updateClock(): void {
    const now = new Date();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    this.currentTime = `${hours}:${minutes}`;
  }


  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.selectedFile = file;
    this.videoError = false;

    this.hasResult = false;
    this.frameDataUrl = null;

    if (this.videoPreviewUrl) {
      URL.revokeObjectURL(this.videoPreviewUrl);
    }

    this.videoPreviewUrl = URL.createObjectURL(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();

    const file = event.dataTransfer?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('video/')) {
      return;
    }

    this.selectedFile = file;
    this.videoError = false;
    this.hasResult = false;
    this.frameDataUrl = null;

    if (this.videoPreviewUrl) {
      URL.revokeObjectURL(this.videoPreviewUrl);
    }

    this.videoPreviewUrl = URL.createObjectURL(file);
  }


  async analyzeVideo(): Promise<void> {
    if (!this.selectedFile || this.isAnalyzing) {
      return;
    }

    this.isAnalyzing = true;
    this.hasResult = false;
    this.videoError = false;

    try {
      const frame = await this.extractVideoFrame(this.selectedFile);

      await this.delay(900);

      this.detected = Math.random() < 0.5;

      if (this.detected) {
        this.occurrenceCount++;
      }

      this.frameDataUrl = frame;
      this.hasResult = true;

    } catch (error) {
      console.error('Erro ao analisar vídeo:', error);
      this.videoError = true;
    } finally {
      this.isAnalyzing = false;
    }
  }

  private extractVideoFrame(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(file);
      const video = document.createElement('video');

      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;

      video.addEventListener('loadeddata', () => {
        const seekTime = Math.min(
          1.5,
          (video.duration || 3) / 2
        );

        video.currentTime = seekTime;
      });

      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');

          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;

          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error('Canvas não suportado.');
          }

          context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const frame = canvas.toDataURL(
            'image/jpeg',
            0.85
          );

          URL.revokeObjectURL(videoUrl);

          resolve(frame);
        } catch (error) {
          URL.revokeObjectURL(videoUrl);
          reject(error);
        }
      });

      video.addEventListener('error', () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Não foi possível ler o vídeo.'));
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getFileSize(): string {
    if (!this.selectedFile) {
      return '';
    }

    return `${(
      this.selectedFile.size / (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  getFileName(): string {
    if (!this.selectedFile) {
      return '';
    }

    const name = this.selectedFile.name;

    return name.length > 34
      ? `${name.slice(0, 31)}…`
      : name;
  }

  getBarHeight(value: number): string {
    return `${(value / this.maxChartValue) * 100}%`;
  }

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }

    if (this.videoPreviewUrl) {
      URL.revokeObjectURL(this.videoPreviewUrl);
    }
  }
}