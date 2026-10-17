/** Denge simülasyonundaki oyuncu profilleri: ödüllü reklam fırsatlarının ne kadarını değerlendirir. */
export interface Profile {
  id: 'noAds' | 'sometimes' | 'often';
  label: string;
  /** Ödüllü reklam teklifini kabul etme olasılığı. */
  adRate: number;
}

export const PROFILES: readonly Profile[] = [
  { id: 'noAds', label: 'Reklam izlemeyen', adRate: 0 },
  { id: 'sometimes', label: 'Ara sıra izleyen (%30)', adRate: 0.3 },
  { id: 'often', label: 'Sık izleyen (%70)', adRate: 0.7 },
];
