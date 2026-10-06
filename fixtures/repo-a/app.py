# repo-a (fixture) — web fittizia cliente clientone (e riusabile per altri clienti)
from repo_b import calc_price  # S3: import cross-cartella verso repo-b


def quote(order):
    return calc_price(order)
