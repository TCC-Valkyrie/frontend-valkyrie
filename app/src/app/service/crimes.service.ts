import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResultadoCrime {
  id?: number;
  resultado: boolean;
  accuracy: number;
  dataHora?: string;
}

export interface CrimeMes {
  mes: string;
  quantidade: number;
}

@Injectable({
  providedIn: 'root',
})
export class CrimesService {
  private http = inject(HttpClient);

  private apiUrl = 'http://localhost:8080/file';

  listarCrimesMes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/by-month`);
  }

  enviarImagemCrime(imagem: File): Observable<ResultadoCrime> {
    const formData = new FormData();

    formData.append('imagem', imagem, imagem.name);

    return this.http.post<ResultadoCrime>(this.apiUrl, formData);
  }

  listarTodosCrimes(): Observable<ResultadoCrime[]> {
    return this.http.get<ResultadoCrime[]>(this.apiUrl);
  }
}
