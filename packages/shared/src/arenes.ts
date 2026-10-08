import coffre from '../arenes/coffre.json';
import marbre from '../arenes/marbre.json';
import rotative from '../arenes/rotative.json';
import type { Arene } from './monde';

// Ajouter une arène = un fichier JSON dans arenes/ + une ligne ici.
export const ARENES = [marbre, rotative, coffre] as unknown as Arene[];
