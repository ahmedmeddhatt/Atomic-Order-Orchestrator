import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number = 50; // Default page size

  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'status' = 'updatedAt';

  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
