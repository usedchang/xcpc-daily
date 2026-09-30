#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
struct ZTrie{
    vector<array<int,2>>a;
    vector<int>cnt;
    vector<int>c;
    int idx;
    ZTrie(int n){
        a.resize(n+1);
        cnt.resize(n+1);
        c.resize(n+1);
        idx=0;
        for(int i=0;i<=n;i++) a[i].fill(0);
    }
    void add(int x) {
        int p=0;
        for(int i=0;i<=31;i++){
            int bit=(x>>i&1);
            if(!a[p][bit]){
                a[p][bit]=(++idx);
            }
            p=a[p][bit];
            c[i]+=bit;
            cnt[p]++;
        }
    }
    void erase(int x){
        int p=0;
        for(int i=0;i<=31;i++){
            int bit=(x>>i&1);
            p=a[p][bit];
            c[i]-=bit;
            cnt[p]--;
        }
    }
    void add1(){
        int p=0;
        for(int i=0;i<=31;i++){
            int L=a[p][0],R=a[p][1];
            c[i]+=cnt[L]-cnt[R];
            swap(a[p][0],a[p][1]);
            if(!R) return;
            p=R;
        }
    }
    ll XorAll(){
        ll ans=0;
        for(int i=0;i<=31;i++){
            if(c[i]&1) ans|=(1LL<<i);
        }
        return ans;
    }
};
void solve(){
    int n,q;
    cin>>n>>q;
    vector<ll>a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i];
    ZTrie T((n+q)*31+5);
    for(int i=1;i<=n;i++) T.add(a[i]);
    ll p,t=0,x;
    for(int i=1;i<=q;i++){
        int op;cin>>op;
        if(op==0){
            cin>>x>>p;
            T.erase(a[x]+t);
            T.add(p);
            a[x]=p-t;
        }
        else if(op==1) T.add1(),t++;
        else cout<<T.XorAll()<<endl;
    }
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    solve();
    return 0;
}