# Algorithms & Math Notes

This page collects short math and algorithm notes useful when reasoning about vector search, HNSW, similarity, and evaluation.

Cosine similarity
-----------------

Cosine similarity between vectors $a$ and $b$ is:

$$
\text{cosine}(a, b) = \frac{a \cdot b}{\|a\| \, \|b\|}
$$

To use cosine with dot-product indexes, normalize vectors at insert and query time: $a' = a / \|a\|$.

Dot product and L2
------------------

Dot product: $a \cdot b$.

L2 distance: $\|a - b\|_2$.

Relationship notes
------------------

- For normalized vectors, maximizing dot product equals maximizing cosine similarity.

Evaluation metrics
------------------

- Recall@k: fraction of ground-truth neighbors included in the top-k results.
- MRR: $\frac{1}{Q} \sum_{i=1}^Q \frac{1}{\text{rank}_i}$ where rank_i is the position of the first relevant result for query i.
