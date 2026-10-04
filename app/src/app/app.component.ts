import {
  Component,
  OnDestroy,
  OnInit,
  Signal,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';

import { CommonModule } from '@angular/common';

import { CrimesService, ResultadoCrime } from './service/crimes.service';

import { DateInterface } from './types/date';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  private CrimesService = inject(CrimesService);

  // ----------------------------------------
  // Estado da aplicação
  // ----------------------------------------

  cameraCount = 128;

  occurrenceCount = 0;

  currentTime = '';

  selectedFile: File | null = null;

  videoPreviewUrl: string | null = null;

  frameDataUrl: string | null = null;

  isAnalyzing = false;

  detected = false;

  hasResult = false;

  videoError = false;

  accuracy = 0;

  errorMessage = '';

  isImage: WritableSignal<boolean> = signal(false);
  typeImage: WritableSignal<string> = signal("")

  private clockInterval?: ReturnType<typeof setInterval>;

  get maxChartValue(): number {
    if (!this.chartData().length) {
      return 1;
    }

    return Math.max(...this.chartData().map((item) => item.value), 1);
  }

  chartData: WritableSignal<DateInterface[]> = signal([]);

  constructor() {
    this.updateClock();

    this.clockInterval = setInterval(() => {
      this.updateClock();
    }, 30000);
  }

  ngOnInit(): void {
    this.carregarDados();
  }

  // ----------------------------------------
  // CARREGAMENTO DOS DADOS
  // ----------------------------------------

  private carregarDados(): void {
    this.carregarOcorrencias();
    this.carregarGrafico();
  }

  private carregarOcorrencias(): void {
    this.CrimesService.listarTodosCrimes().subscribe({
      next: (crimes: ResultadoCrime[]) => {
        this.occurrenceCount = crimes.length;
      },

      error: (error) => {
        console.error('Erro ao carregar ocorrências:', error);
      },
    });
  }

  private carregarGrafico(): void {
    this.CrimesService.listarCrimesMes().subscribe({
      next: (dados: any[]) => {
        console.log('1 - API:', dados);

        this.chartData.set(
          dados.map((item: any[]) => ({
            day: item[0],
            value: Number(item[1]),
            highlight: false,
          })),
        );

        console.log('2 - chartData:', this.chartData());
        console.log('3 - length:', this.chartData().length);
      },

      error: (error) => {
        console.error('Erro ao carregar gráfico:', error);
        this.chartData.set([]);
      },
    });
  }

  // ----------------------------------------
  // RELÓGIO
  // ----------------------------------------

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

    this.setSelectedFile(file);
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
      this.videoError = true;

      this.errorMessage = 'Selecione um arquivo de vídeo válido.';

      return;
    }

    this.setSelectedFile(file);
  }

  private setSelectedFile(file: File): void {
    this.selectedFile = file;

    this.videoError = false;

    this.errorMessage = '';

    this.hasResult = false;

    this.frameDataUrl = null;

    this.detected = false;

    this.accuracy = 0;

    if (this.videoPreviewUrl) {
      URL.revokeObjectURL(this.videoPreviewUrl);
    }

    this.videoPreviewUrl = URL.createObjectURL(file);
  }

  // ----------------------------------------
  // ANÁLISE
  // ----------------------------------------

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result as string);
      };

      reader.onerror = () => {
        reject(new Error('Não foi possível carregar a imagem.'));
      };

      reader.readAsDataURL(file);
    });
  }

  async analyzeVideo(): Promise<void> {
    if (!this.selectedFile || this.isAnalyzing) {
      return;
    }

    this.isAnalyzing = true;

    this.hasResult = false;
    this.videoError = false;
    this.errorMessage = '';

    try {
      /*
       * A imagem selecionada já é um File.
       * Não precisamos extrair frame nem converter Base64.
       */

      const imageFile = this.selectedFile;

      console.log('Imagem enviada:', imageFile);

      this.isImage.set(!imageFile.type.startsWith("video/"))
      this.typeImage.set(imageFile.type)
      /*
       * Mostra a imagem selecionada no resultado
       */
      this.frameDataUrl = await this.fileToDataUrl(imageFile);

      /*
       * Envia a imagem diretamente para o backend
       */
      this.CrimesService.enviarImagemCrime(imageFile).subscribe({
        next: (response: ResultadoCrime) => {
          console.log('Resposta do backend:', response);

          /*
           * Resultado da IA/backend
           */
          this.detected = response.resultado;

          /*
           * Confiança da análise
           */
          this.accuracy = response.accuracy;

          this.hasResult = true;

          this.isAnalyzing = false;

          /*
           * Atualiza os dados
           */
          this.carregarOcorrencias();

          this.carregarGrafico();
        },

        error: (error) => {
          console.error('Erro ao analisar imagem:', error);

          this.videoError = true;

          this.hasResult = false;

          this.isAnalyzing = false;

          this.errorMessage = this.obterMensagemErro(error);
        },
      });
    } catch (error) {
      console.error('Erro ao processar imagem:', error);

      this.videoError = true;

      this.hasResult = false;

      this.isAnalyzing = false;

      this.errorMessage = 'Não foi possível processar a imagem.';
    }
  }

  // ----------------------------------------
  // CONVERTER BASE64 → FILE
  // ----------------------------------------

  private dataUrlToFile(dataUrl: string, fileName: string): File {
    const parts = dataUrl.split(',');

    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';

    const binary = atob(parts[1]);

    const array = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }

    return new File([array], fileName, {
      type: mime,
    });
  }

  // ----------------------------------------
  // EXTRAIR FRAME DO VÍDEO
  // ----------------------------------------

  private extractVideoFrame(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(file);

      const video = document.createElement('video');

      video.src = videoUrl;

      video.muted = true;

      video.playsInline = true;

      video.preload = 'metadata';

      video.addEventListener('loadedmetadata', () => {
        const duration = video.duration || 3;

        const seekTime = Math.min(1.5, duration / 2);

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

          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const frame = canvas.toDataURL('image/jpeg', 0.85);

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

  // ----------------------------------------
  // MENSAGEM DE ERRO
  // ----------------------------------------

  private obterMensagemErro(error: any): string {
    if (error?.status === 0) {
      return 'Não foi possível conectar ao servidor.';
    }

    if (error?.status === 400) {
      return 'A imagem enviada é inválida.';
    }

    if (error?.status === 413) {
      return 'A imagem enviada é muito grande.';
    }

    if (error?.status >= 500) {
      return 'Ocorreu um erro no servidor durante a análise.';
    }

    return error?.error?.message || error?.message || 'Não foi possível analisar a imagem.';
  }

  // ----------------------------------------
  // UTILITÁRIOS
  // ----------------------------------------

  getFileSize(): string {
    if (!this.selectedFile) {
      return '';
    }

    return `${(this.selectedFile.size / (1024 * 1024)).toFixed(1)} MB`;
  }

  getFileName(): string {
    if (!this.selectedFile) {
      return '';
    }

    const name = this.selectedFile.name;

    return name.length > 34 ? `${name.slice(0, 31)}…` : name;
  }

  getBarHeight(value: number): string {
    return `${(value / this.maxChartValue) * 100}%`;
  }

  getAccuracy(): string {
    return (this.accuracy).toFixed(2) + '%';
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
