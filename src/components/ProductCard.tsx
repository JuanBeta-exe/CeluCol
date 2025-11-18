import { Button } from './ui/button';
import { Card, CardContent, CardFooter } from './ui/card';
import { ShoppingCart, Pencil, Trash2 } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  stock?: number;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  isAdmin?: boolean;
}

export function ProductCard({ product, onAddToCart, onEdit, onDelete, isAdmin }: ProductCardProps) {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.imageUrl ? (
          <ImageWithFallback
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Sin imagen
          </div>
        )}
      </div>
      
      <CardContent className="p-4 flex-1">
        <h3 className="mb-2 line-clamp-1">{product.name}</h3>
        <p className="text-muted-foreground mb-2 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between">
          <p className="text-primary">${product.price.toFixed(2)}</p>
          {product.stock !== undefined && (
            <p className={`text-sm ${product.stock > 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
              Stock: {product.stock}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 gap-2">
        {isAdmin ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit?.(product)}
            >
              <Pencil className="size-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => onDelete?.(product.id)}
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar
            </Button>
          </>
        ) : (
          <Button
            className="w-full"
            onClick={() => onAddToCart?.(product.id)}
            disabled={product.stock !== undefined && product.stock <= 0}
          >
            <ShoppingCart className="size-4 mr-2" />
            {product.stock !== undefined && product.stock <= 0 ? 'Sin Stock' : 'Agregar al Carrito'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
