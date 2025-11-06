import PocketBase from 'pocketbase';
import type { TypedPocketBase } from "./pocketbase-types";
var path = '';
if (import.meta.env.MODE === 'development')
    path = 'http://localhost:8085'    //localhost = machine de dev
else path = 'https://tavuee.ethantouitou.fr:443'   //url du site 
const pb = new PocketBase(path) as TypedPocketBase;
export default pb;