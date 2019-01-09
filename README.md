# tahoiyabot
AIにたほいやをする仕事を奪われる人

```sh
wget https://dumps.wikimedia.org/jawiki/20181220/jawiki-20181220-pages-meta-current.xml.bz2
node generate-dataset.js jawiki-20181220-pages-meta-current.xml.bz2
shuf entries.tsv > entries.scrambled.tsv
cut -f2 < entries.scrambled.tsv > entries.src.txt
cut -f3 < entries.scrambled.tsv > entries.dst.txt
mecab -Owakati < entries.dst.txt > entries.dst.tok.txt
git clone https://github.com/rsennrich/subword-nmt
./subword-nmt/subword_nmt/learn_bpe.py -s 32000 < entries.dst.tok.txt > entries.dst.tok.bpe.32000.vocab.txt
./subword-nmt/subword_nmt/apply_bpe.py -c entries.dst.tok.bpe.32000.vocab.txt < entries.dst.tok.txt > entries.dst.tok.bpe.32000.txt
git clone https://github.com/google/seq2seq.git
./seq2seq/bin/tools/generate_vocab.py < entries.dst.bpe.32000.txt > entries.dst.bpe.32000.vocab.txt
./seq2seq/bin/tools/generate_vocab.py --delimiter "" < entries.src.txt > entries.src.vocab.txt
```
