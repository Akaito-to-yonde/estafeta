export type ProfileEstado = 'pending' | 'approved' | 'rejected' | 'registered';
export type UserCategoria = 'admin' | 'producer' | 'provider' | 'services' | 'client';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  categoria: UserCategoria;
  estado: ProfileEstado;
  nombre_empresa: string;
  direccion_legal: string;
  contacto: string;
  num_fijo?: string;
  num_movil?: string;
  actividad?: string;
  oferta_busqueda?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileDto {
  email: string;
  categoria: UserCategoria;
  nombre_empresa: string;
  direccion_legal: string;
  contacto: string;
  num_fijo?: string;
  num_movil?: string;
  actividad?: string;
  oferta_busqueda?: string;
}

export interface ProfileFilters {
  estado?: ProfileEstado;
  categoria?: UserCategoria;
}
