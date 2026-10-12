"""Independent verifier for the fictional PDF fixture (never model context)."""
import json
from decimal import Decimal, InvalidOperation
from datetime import date

FIELDS = ('transaction_id', 'tax_type', 'amount', 'currency', 'date', 'status')

def money(value):
    if isinstance(value, bool) or value is None:
        raise ValueError('missing/invalid amount')
    result = Decimal(str(value))
    if not result.is_finite() or result < 0 or result != result.quantize(Decimal('0.01')):
        raise ValueError('invalid amount precision')
    return result

def compare_fields(actual, expected):
    actual = actual if isinstance(actual, dict) else {}
    comparisons = []
    for key in FIELDS:
        if key not in actual:
            outcome = 'missing'
        else:
            try:
                equal = money(actual[key]) == money(expected[key]) if key == 'amount' else actual[key] == expected[key]
            except (ValueError, InvalidOperation):
                equal = False
            outcome = 'match' if equal else 'mismatch'
        comparisons.append({'field': key, 'outcome': outcome, 'expected': expected[key], 'actual': actual.get(key)})
    return {'passed': all(x['outcome'] == 'match' for x in comparisons), 'fields': comparisons}

def totals(documents, start, end):
    """Fail closed for incomplete evidence; duplicates retain first occurrence."""
    start, end = date.fromisoformat(start), date.fromisoformat(end)
    seen, included, excluded = set(), [], {}
    currencies = {c: {'gross': Decimal(0), 'refunds': Decimal(0)} for c in ('CAD', 'USD')}
    for item in documents:
        doc, row = item['document'], item.get('actual')
        if not isinstance(row, dict) or any(key not in row for key in FIELDS):
            excluded[doc] = 'missing_evidence'; continue
        tx = row['transaction_id']
        if not isinstance(tx, str) or not tx.strip():
            excluded[doc] = 'missing_transaction_id'; continue
        if tx in seen:
            excluded[doc] = 'duplicate'; continue
        seen.add(tx)
        if row['status'] not in ('settled', 'refunded'):
            excluded[doc] = 'not_settled'; continue
        try:
            when = date.fromisoformat(row['date'])
        except (ValueError, TypeError):
            excluded[doc] = 'missing_date'; continue
        if not start <= when <= end:
            excluded[doc] = 'outside_period'; continue
        if row['currency'] not in ('CAD', 'USD'):
            excluded[doc] = 'unknown_currency'; continue
        try:
            amount = money(row['amount'])
        except (ValueError, InvalidOperation):
            excluded[doc] = 'invalid_amount'; continue
        if row['tax_type'] not in ('GST', 'QST'):
            excluded[doc] = 'unknown_tax_type'; continue
        included.append(doc)
        bucket = currencies.setdefault(row['currency'], {'gross': Decimal(0), 'refunds': Decimal(0)})
        bucket['refunds' if row['status'] == 'refunded' else 'gross'] += amount
    for bucket in currencies.values():
        bucket['net'] = bucket['gross'] - bucket['refunds']
    return {'included_documents': included, 'excluded_documents': excluded,
            'currency_totals': {c: {k: float(v) for k, v in b.items()} for c, b in currencies.items()}}

def compare_totals(actual, expected):
    if not isinstance(actual, dict):
        return {'passed': False, 'reason': 'missing structured totals'}
    included = actual.get('included_documents')
    excluded = actual.get('excluded_documents')
    currencies = actual.get('currency_totals')
    if not isinstance(included, list) or not all(isinstance(x, str) for x in included):
        return {'passed': False, 'reason': 'included_documents must be a list of strings'}
    if not isinstance(excluded, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in excluded.items()):
        return {'passed': False, 'reason': 'excluded_documents must map strings to string reasons'}
    if not isinstance(currencies, dict) or not all(isinstance(k, str) and isinstance(v, dict) for k, v in currencies.items()):
        return {'passed': False, 'reason': 'currency_totals must map currency strings to objects'}
    if any(any(key not in bucket or not isinstance(bucket[key], (int, float)) or isinstance(bucket[key], bool) for key in ('gross', 'refunds', 'net')) for bucket in currencies.values()):
        return {'passed': False, 'reason': 'currency total members must be numeric gross/refunds/net'}
    same_included = sorted(included) == sorted(expected['included_documents'])
    same_excluded = set(actual.get('excluded_documents', {})) == set(expected['excluded_documents'])
    try:
        ac, ex = actual['currency_totals'], expected['currency_totals']
        same_money = set(ac) == set(ex) and all(money(ac[c][k]) == money(ex[c][k]) for c in ex for k in ('gross', 'refunds', 'net'))
    except (KeyError, ValueError, InvalidOperation, TypeError):
        same_money = False
    return {'passed': same_included and same_excluded and same_money,
            'included_documents_match': same_included, 'excluded_documents_match': same_excluded,
            'currency_totals_match': same_money}

def parse_answer(text):
    text = text.strip()
    if text.startswith('```'):
        lines = text.splitlines()
        if lines[-1].strip() == '```':
            text = '\n'.join(lines[1:-1]).strip()
    return json.loads(text)
